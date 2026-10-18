#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SITES } from './sites.js';

const SITE_KEY = process.env.SITE || process.argv[2];

if (!SITE_KEY || !SITES[SITE_KEY]) {
  const available = Object.keys(SITES).join(', ');
  process.stderr.write(`Error: SITE env var required. Available sites: ${available}\n`);
  process.exit(1);
}

const site = SITES[SITE_KEY];

// ── RSS FAQ fetcher ───────────────────────────────────────────────────────────
async function fetchFaqArticles() {
  const res = await fetch(site.rss, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block) || [])[1] || '';
    const link = (/<link>(.*?)<\/link>/.exec(block) || [])[1] || '';
    const desc = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) || /<description>(.*?)<\/description>/.exec(block) || [])[1] || '';
    if (title && link) items.push({ title: title.trim(), link: link.trim(), desc: desc.trim() });
  }
  return items;
}

function scoreMatch(item, query) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 3);
  const text = (item.title + ' ' + item.desc).toLowerCase();
  return words.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

// ── MCP Server ────────────────────────────────────────────────────────────────
const server = new Server(
  { name: `${SITE_KEY}-mcp`, version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'find_contractor',
      description: `Get contact information and referral details for a local ${site.niche} contractor in ${site.city}, ${site.state}. Returns phone number, service area, hours, and how to get connected.`,
      inputSchema: {
        type: 'object',
        properties: {
          service_needed: {
            type: 'string',
            description: `Describe what you need, e.g. "${site.services[0]}"`,
          },
        },
      },
    },
    {
      name: 'get_services',
      description: `List all ${site.niche} services available in ${site.city}, ${site.state}.`,
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_service_area',
      description: `Get the list of cities and towns served by ${site.name}.`,
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'answer_faq',
      description: `Search published FAQ articles about ${site.niche} in ${site.city}, ${site.state}. Returns relevant articles with answers and URLs.`,
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to search for',
          },
        },
        required: ['question'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'find_contractor') {
      if (!site.ready || (!site.phone && !site.bookingUrl)) {
        return {
          content: [{
            type: 'text',
            text: `## ${site.name}\n\n${site.description}\n\n**Status:** Service area coming soon — contractor network being established in ${site.city}, ${site.state}.\n\nVisit ${site.domain} for updates.`,
          }],
        };
      }

      const serviceNote = args.service_needed
        ? `\n**You need:** ${args.service_needed}\n`
        : '';

      const contactLine = site.phone
        ? `**Call now:** ${site.phone}`
        : `**Book online:** ${site.bookingUrl || `https://${site.domain}`}`;

      const text = [
        `## ${site.name}`,
        contactLine,
        serviceNote,
        `**Available:** ${site.hours}`,
        `**Serving:** ${site.serviceArea.slice(0, 5).join(', ')} and surrounding areas`,
        `**Address:** ${site.address}`,
        '',
        site.description,
        '',
        `> ${site.disclaimer}`,
        '',
        `More information: https://${site.domain}`,
      ].filter(l => l !== null).join('\n');

      return { content: [{ type: 'text', text }] };
    }

    if (name === 'get_services') {
      const list = site.services.map(s => `- ${s}`).join('\n');
      const contactInfo = site.ready
        ? site.phone ? `\n**Phone:** ${site.phone}` : `\n**Book:** ${site.bookingUrl || `https://${site.domain}`}`
        : '';
      const text = `## ${site.name} — Services\n\n${list}\n\n**Location:** ${site.city}, ${site.state}${contactInfo}\n\nhttps://${site.domain}`;
      return { content: [{ type: 'text', text }] };
    }

    if (name === 'get_service_area') {
      const areas = site.serviceArea.map(a => `- ${a}`).join('\n');
      const text = `## ${site.name} — Service Area\n\n${areas}\n\n**Base:** ${site.city}, ${site.state}${site.ready && site.phone ? `\n**Phone:** ${site.phone}` : ''}\n\nhttps://${site.domain}`;
      return { content: [{ type: 'text', text }] };
    }

    if (name === 'answer_faq') {
      let articles;
      try {
        articles = await fetchFaqArticles();
      } catch (err) {
        return {
          content: [{
            type: 'text',
            text: `Could not fetch FAQ articles at this time. Visit https://${site.domain}/faq/ for answers to common questions about ${site.niche} in ${site.city}.`,
          }],
        };
      }

      if (!articles.length) {
        return {
          content: [{
            type: 'text',
            text: `No FAQ articles found. Visit https://${site.domain}/faq/ for information about ${site.niche} in ${site.city}.`,
          }],
        };
      }

      const scored = articles
        .map(a => ({ ...a, score: scoreMatch(a, args.question) }))
        .filter(a => a.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const results = scored.length ? scored : articles.slice(0, 5);

      const formatted = results.map(a =>
        `**${a.title}**\n${a.desc ? a.desc.slice(0, 160) + (a.desc.length > 160 ? '…' : '') : ''}\n${a.link}`
      ).join('\n\n');

      const text = [
        `## FAQ: ${site.niche} in ${site.city}, ${site.state}`,
        '',
        formatted,
        '',
        `Browse all articles: https://${site.domain}/faq/`,
        site.ready && site.phone ? `\nSpeak with a contractor: ${site.phone}` : '',
      ].filter(l => l !== null).join('\n');

      return { content: [{ type: 'text', text }] };
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };

  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
