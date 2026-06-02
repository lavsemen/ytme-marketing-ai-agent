import { getEnv } from '../../utils/env.js';
import { logger } from '../../utils/logger.js';
import type { PipelineResult, RejectedPipelineResult, RejectionReason } from '../../types/result.js';

/**
 * Posts pipeline outcomes to Slack via chat.postMessage (Bot token).
 * No-op when SLACK_BOT_TOKEN or SLACK_CHANNEL_ID is unset — generation must
 * never fail because Slack is down or misconfigured.
 */

const SLACK_API = 'https://slack.com/api/chat.postMessage';
const MAX_SECTION_CHARS = 2800;

const REJECTION_LABELS: Record<RejectionReason, string> = {
  no_news: 'Нет новостей',
  low_confidence: 'Низкая релевантность',
  unknown_country: 'Не определена страна',
  blocked_country: 'Страна в чёрном списке',
  no_tours: 'Мало туров',
  llm_error: 'Ошибка LLM',
};

interface SlackConfig {
  token: string;
  channel: string;
}

function slackConfig(): SlackConfig | null {
  const env = getEnv();
  const token = env.SLACK_BOT_TOKEN;
  const channel = env.SLACK_CHANNEL_ID;
  if (!token || !channel) return null;
  return { token, channel };
}

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function postMessage(
  cfg: SlackConfig,
  blocks: object[],
  fallbackText: string,
): Promise<void> {
  const res = await fetch(SLACK_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: cfg.channel,
      text: fallbackText,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `Slack HTTP ${res.status}`);
  }
}

export async function notifySlackSuccess(result: PipelineResult): Promise<void> {
  const cfg = slackConfig();
  if (!cfg) return;

  const { post, news, insight, landing, tours } = result;
  const title = escapeMrkdwn(post.marketingTitle);
  const bodyText = escapeMrkdwn(truncate(post.marketingText, MAX_SECTION_CHARS));
  const country = escapeMrkdwn(insight.country || '—');

  const blocks: object[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'News2Trip — пост готов', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${title}*` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Страна:*\n${country}` },
        { type: 'mrkdwn', text: `*Туров:*\n${tours.length}` },
        { type: 'mrkdwn', text: `*Новость:*\n${escapeMrkdwn(news.title)}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: bodyText },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${landing.url}|Открыть лендинг> · <${news.sourceUrl}|Источник новости>`,
      },
    },
  ];

  if (post.imageUrl) {
    blocks.push({
      type: 'image',
      image_url: post.imageUrl,
      alt_text: post.marketingTitle,
    });
  }

  await postMessage(cfg, blocks, `News2Trip: ${post.marketingTitle}`);
  logger.info({ channel: cfg.channel }, 'Slack success notification sent');
}

export async function notifySlackRejected(result: RejectedPipelineResult): Promise<void> {
  const cfg = slackConfig();
  if (!cfg) return;

  const reasonLabel = REJECTION_LABELS[result.reason] ?? result.reason;
  const headline =
    result.topInsight?.title ??
    result.newsSampled[0]?.title ??
    `Пропуск (${result.reason})`;

  const fields: object[] = [
    { type: 'mrkdwn', text: `*Причина:*\n${escapeMrkdwn(reasonLabel)}` },
  ];
  if (result.topInsight?.country) {
    fields.push({
      type: 'mrkdwn',
      text: `*Страна:*\n${escapeMrkdwn(result.topInsight.country)}`,
    });
  }
  if (result.sourceId) {
    fields.push({ type: 'mrkdwn', text: `*Источник:*\n${escapeMrkdwn(result.sourceId)}` });
  }

  const blocks: object[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'News2Trip — генерация пропущена', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${escapeMrkdwn(headline)}*` },
    },
    { type: 'section', fields },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: escapeMrkdwn(truncate(result.message, MAX_SECTION_CHARS)) },
    },
  ];

  const sample = result.newsSampled[0];
  if (sample?.url) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<${sample.url}|${escapeMrkdwn(sample.sourceName)}: ${escapeMrkdwn(sample.title)}>`,
        },
      ],
    });
  }

  await postMessage(cfg, blocks, `News2Trip пропущен: ${reasonLabel}`);
  logger.info({ channel: cfg.channel, reason: result.reason }, 'Slack rejection notification sent');
}

/** Fire-and-forget wrapper — logs warnings, never throws to caller. */
export async function tryNotifySlackSuccess(result: PipelineResult): Promise<void> {
  try {
    await notifySlackSuccess(result);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Slack success notification failed',
    );
  }
}

export async function tryNotifySlackRejected(result: RejectedPipelineResult): Promise<void> {
  try {
    await notifySlackRejected(result);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Slack rejection notification failed',
    );
  }
}
