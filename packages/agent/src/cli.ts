import { Command } from 'commander';
import { logger } from './utils/logger.js';
import { loadSources } from './pipeline.js';
import { listResults } from './modules/deploy/persist.js';
import { isRejected } from './types/result.js';
import { loadSchedules, markScheduleRuleFired, clearScheduleRuleFiredIfMatches } from './config/agentConfig.js';
import { decideRulesToRun } from './modules/schedule/cronScheduler.js';
import { runGeneration } from './runGeneration.js';

const program = new Command();
program
  .name('agent')
  .description('YouTravel.me marketing AI agent CLI')
  .version('0.1.0');

program
  .command('generate')
  .description('Run the full pipeline: news -> insight -> collections -> post -> landing')
  .option('-s, --source <id>', 'Run for a specific source id (default: all enabled)')
  .option('--run-id <id>', 'External run id (e.g. GitHub Actions run id)')
  .option(
    '--hint <text>',
    'Marketer hint for this run (passed to all LLM calls): e.g. "focus on family travel"',
  )
  .action(async (opts) => {
    try {
      const result = await runGeneration({
        ...(opts.source ? { sourceId: opts.source as string } : { sourceId: 'all' }),
        ...(opts.runId ? { runId: opts.runId as string } : {}),
        ...(opts.hint ? { hint: opts.hint as string } : {}),
        trigger: 'manual',
      });

      if (isRejected(result)) {
        logger.warn(
          { reason: result.reason, message: result.message },
          'Generation rejected (saved as skipped run)',
        );
        process.stdout.write(
          JSON.stringify({
            ok: false,
            status: 'rejected',
            reason: result.reason,
            message: result.message,
          }) + '\n',
        );
        return;
      }

      logger.info(
        { slug: result.landing.slug, url: result.landing.url },
        'Generation complete',
      );
      process.stdout.write(
        JSON.stringify({
          ok: true,
          status: 'success',
          slug: result.landing.slug,
          url: result.landing.url,
        }) + '\n',
      );
    } catch (err) {
      logger.error({ err }, 'Pipeline failed');
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List generated results (latest 50 from Firestore)')
  .action(async () => {
    const results = await listResults();
    if (results.length === 0) {
      process.stdout.write('No results yet.\n');
      return;
    }
    for (const r of results) {
      const status = r.status === 'rejected' ? '[rejected]' : '          ';
      process.stdout.write(
        `${r.createdAt}  ${status} ${r.slug.padEnd(40)} ${(r.country ?? '-').padEnd(10)} collections:${r.collectionsCount ?? r.toursCount}  ${r.landingUrl ?? '-'}\n`,
      );
    }
  });

program
  .command('run-scheduled')
  .description('Run schedule rules in their current cron slot (dedup per tick via Firestore)')
  .option('--run-id <id>', 'External run id prefix (e.g. GitHub Actions run id)')
  .option('--force', 'Run every enabled rule, ignoring the time window', false)
  .action(async (opts) => {
    const schedules = await loadSchedules();
    const force = Boolean(opts.force);
    const { active, skipped } = decideRulesToRun(schedules.rules, { force });

    const alreadyFired = active.filter(
      (d) => !force && d.rule.lastFiredPrevTick === d.prevTick.toISOString(),
    );
    const toRun = active.filter(
      (d) => force || d.rule.lastFiredPrevTick !== d.prevTick.toISOString(),
    );

    logger.info(
      {
        total: schedules.rules.length,
        active: toRun.length,
        skipped: skipped.length,
        alreadyFired: alreadyFired.length,
        force,
      },
      'Scheduler decision',
    );
    for (const s of skipped) {
      logger.info(
        {
          ruleId: s.rule.id,
          ruleName: s.rule.name,
          reason: s.skipReason,
          prevTick: s.prevTick.toISOString(),
          nextTick: s.nextTick?.toISOString(),
          error: s.error,
        },
        'Schedule rule skipped',
      );
    }
    for (const s of alreadyFired) {
      logger.info(
        {
          ruleId: s.rule.id,
          ruleName: s.rule.name,
          prevTick: s.prevTick.toISOString(),
        },
        'Schedule rule already fired for this tick',
      );
    }

    if (toRun.length === 0) {
      process.stdout.write(
        JSON.stringify({
          ok: true,
          status: 'no-rules-due',
          total: schedules.rules.length,
          skipped: skipped.length,
          alreadyFired: alreadyFired.length,
        }) + '\n',
      );
      return;
    }

    const runIdPrefix = (opts.runId as string | undefined)?.trim();
    const summary: Array<Record<string, unknown>> = [];
    let hadFailure = false;

    for (const decision of toRun) {
      const rule = decision.rule;
      const runId = runIdPrefix
        ? `${runIdPrefix}-${rule.id.slice(0, 8)}`
        : `sched-${Date.now()}-${rule.id.slice(0, 8)}`;

      logger.info(
        { ruleId: rule.id, ruleName: rule.name, source: rule.source, runId, prevTick: decision.prevTick.toISOString() },
        'Running scheduled rule',
      );

      try {
        const result = await runGeneration({
          sourceId: rule.source || 'all',
          ...(rule.hint ? { hint: rule.hint } : {}),
          runId,
          trigger: 'scheduled',
        });
        if (isRejected(result)) {
          await clearScheduleRuleFiredIfMatches(rule.id, decision.prevTick);
          summary.push({
            ruleId: rule.id,
            name: rule.name,
            runId,
            status: 'rejected',
            reason: result.reason,
            message: result.message,
          });
          logger.warn(
            { ruleId: rule.id, ruleName: rule.name, reason: result.reason },
            'Scheduled run rejected (saved as skipped)',
          );
        } else {
          await markScheduleRuleFired(rule.id, decision.prevTick);
          summary.push({
            ruleId: rule.id,
            name: rule.name,
            runId,
            status: 'success',
            slug: result.landing.slug,
            url: result.landing.url,
          });
          logger.info(
            { ruleId: rule.id, ruleName: rule.name, slug: result.landing.slug },
            'Scheduled run complete',
          );
        }
      } catch (err) {
        await clearScheduleRuleFiredIfMatches(rule.id, decision.prevTick);
        hadFailure = true;
        summary.push({
          ruleId: rule.id,
          name: rule.name,
          runId,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
        logger.error({ err, ruleId: rule.id, ruleName: rule.name }, 'Scheduled run failed');
      }
    }

    process.stdout.write(
      JSON.stringify({
        ok: !hadFailure,
        status: hadFailure ? 'partial' : 'ok',
        total: schedules.rules.length,
        active: toRun.length,
        skipped: skipped.length,
        alreadyFired: alreadyFired.length,
        runs: summary,
      }) + '\n',
    );

    if (hadFailure) process.exit(1);
  });

program
  .command('cleanup-scheduled')
  .description(
    'Remove all schedule rules and delete runs/results created by scheduled triggers',
  )
  .option('--dry-run', 'Only count documents that would be deleted', false)
  .option('--keep-rules', 'Delete runs/results but keep schedule rules', false)
  .action(async (opts) => {
    try {
      const { cleanupScheduled } = await import('./tools/cleanup-scheduled.js');
      const stats = await cleanupScheduled({
        dryRun: Boolean(opts.dryRun),
        clearRules: !opts.keepRules,
      });
      process.stdout.write(JSON.stringify({ ok: true, ...stats }) + '\n');
    } catch (err) {
      logger.error({ err }, 'cleanup-scheduled failed');
      process.exit(1);
    }
  });

program
  .description('Validate sources.json against the schema')
  .action(async () => {
    try {
      const sources = await loadSources();
      process.stdout.write(`OK: ${sources.length} sources (${sources.filter((s) => s.enabled).length} enabled)\n`);
    } catch (err) {
      logger.error({ err }, 'Validation failed');
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error({ err }, 'CLI fatal error');
  process.exit(1);
});
