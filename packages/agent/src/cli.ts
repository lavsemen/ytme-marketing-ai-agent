import { Command } from 'commander';
import { logger } from './utils/logger.js';
import { runPipeline, loadSources } from './pipeline.js';
import { listResults } from './modules/deploy/manifest.js';

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
  .action(async (opts) => {
    try {
      const result = await runPipeline({
        ...(opts.source ? { sourceId: opts.source as string } : {}),
        ...(opts.runId ? { runId: opts.runId as string } : {}),
      });
      logger.info(
        { slug: result.landing.slug, url: result.landing.url },
        'Generation complete',
      );
      process.stdout.write(JSON.stringify({ ok: true, slug: result.landing.slug, url: result.landing.url }) + '\n');
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
