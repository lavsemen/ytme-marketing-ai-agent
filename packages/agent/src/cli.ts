import { Command } from 'commander';
import { logger } from './utils/logger.js';
import { runPipeline, loadSources } from './pipeline.js';
import { listResults } from './modules/deploy/manifest.js';
import { isRejected } from './types/result.js';
import { loadSchedules } from './config/agentConfig.js';
import { decideRulesToRun } from './modules/schedule/cronScheduler.js';

const program = new Command();
program
  .name('agent')
  .description('YouTravel.me marketing AI agent CLI')
  .version('0.1.0');

program
  .command('generate')
  .description('Run the full pipeline: news -> insight -> tours -> post -> landing')
  .option('-s, --source <id>', 'Run for a specific source id (default: all enabled)')
  .option('--run-id <id>', 'External run id (e.g. GitHub Actions run id)')
  .option(
    '--hint <text>',
    'Marketer hint for this run (passed to all LLM calls): e.g. "focus on family travel"',
  )
  .action(async (opts) => {
    try {
      const result = await runPipeline({
        ...(opts.source ? { sourceId: opts.source as string } : {}),
        ...(opts.runId ? { runId: opts.runId as string } : {}),
        ...(opts.hint ? { hint: opts.hint as string } : {}),
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
  .description('List generated results')
  .action(async () => {
    const results = await listResults();
    if (results.length === 0) {
      process.stdout.write('No results yet.\n');
      return;
    }
    for (const r of results) {
      process.stdout.write(
        `${r.createdAt}  ${r.slug.padEnd(40)} ${r.country ?? '-'.padEnd(10)} tours:${r.toursCount}  ${r.landingUrl}\n`,
      );
    }
  });

program
  .command('run-scheduled')
  .description('Run all schedule rules whose previous cron tick falls in the current UTC hour')
  .option('--run-id <id>', 'External run id prefix (e.g. GitHub Actions run id)')
  .option('--force', 'Run every enabled rule, ignoring the time window', false)
  .action(async (opts) => {
    const schedules = await loadSchedules();
    const { active, skipped } = decideRulesToRun(schedules.rules, {
      force: Boolean(opts.force),
    });

    logger.info(
      {
        total: schedules.rules.length,
        active: active.length,
        skipped: skipped.length,
        force: Boolean(opts.force),
      },
      'Scheduler decision',
    );
    for (const s of skipped) {
      logger.debug(
        { ruleId: s.rule.id, ruleName: s.rule.name, reason: s.skipReason, error: s.error },
        'Schedule rule skipped',
      );
    }

    if (active.length === 0) {
      process.stdout.write(
        JSON.stringify({
          ok: true,
          status: 'no-rules-due',
          total: schedules.rules.length,
          skipped: skipped.length,
        }) + '\n',
      );
      return;
    }

    const runIdPrefix = (opts.runId as string | undefined)?.trim();
    const summary: Array<Record<string, unknown>> = [];
    let hadFailure = false;

    for (const decision of active) {
      const rule = decision.rule;
      const runId = runIdPrefix
        ? `${runIdPrefix}-${rule.id.slice(0, 8)}`
        : `sched-${Date.now()}-${rule.id.slice(0, 8)}`;
      const sourceId = rule.source === 'all' ? undefined : rule.source;

      logger.info(
        { ruleId: rule.id, ruleName: rule.name, source: rule.source, runId },
        'Running scheduled rule',
      );

      try {
        const result = await runPipeline({
          ...(sourceId ? { sourceId } : {}),
          ...(rule.hint ? { hint: rule.hint } : {}),
          runId,
        });
        if (isRejected(result)) {
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
        active: active.length,
        skipped: skipped.length,
        runs: summary,
      }) + '\n',
    );

    if (hadFailure) process.exit(1);
  });

program
  .command('validate-sources')
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
