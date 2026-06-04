/**
 * Lists the approved WhatsApp message templates on your Qontak account, with
 * their IDs — so you can copy one into QONTAK_MESSAGE_TEMPLATE_ID.
 *
 * Read-only (HTTP GET). Sends nothing. Run with: `npm run templates`
 */
import axios from 'axios';
import { config } from '../config';
import { buildMekariAuthHeaders } from '../qontak/mekariSignature';

interface RawTemplate {
  id?: string;
  name?: string;
  language?: string | { code?: string };
  status?: string;
  category?: string;
}

async function main() {
  const path = config.QONTAK_TEMPLATES_PATH;
  const headers = buildMekariAuthHeaders({
    method: 'GET',
    path,
    clientId: config.MEKARI_CLIENT_ID,
    clientSecret: config.MEKARI_CLIENT_SECRET,
  });

  const url = `${config.QONTAK_BASE_URL}${path}`;
  const res = await axios.get(url, {
    headers: { Accept: 'application/json', ...headers },
    validateStatus: () => true,
    timeout: 20_000,
  });

  if (res.status < 200 || res.status >= 300) {
    console.error(`\n❌ Qontak returned ${res.status}`);
    console.error(JSON.stringify(res.data, null, 2));
    console.error(
      '\nIf this is 401: re-check MEKARI_CLIENT_ID/SECRET and that QONTAK_TEMPLATES_PATH ' +
        'matches your Postman collection exactly.\n',
    );
    process.exit(1);
  }

  // Qontak wraps the list in { data: [...] } (sometimes { data: { ... } }).
  const body = res.data as { data?: RawTemplate[] | { templates?: RawTemplate[] } };
  const list: RawTemplate[] = Array.isArray(body?.data)
    ? body.data
    : (body?.data as { templates?: RawTemplate[] })?.templates ?? [];

  if (!list.length) {
    console.log('\nNo templates found in the response. Raw payload:\n');
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }

  console.log(`\n✅ Found ${list.length} template(s):\n`);
  for (const t of list) {
    const lang = typeof t.language === 'object' ? t.language?.code : t.language;
    console.log(`• ${t.name ?? '(no name)'}  [${t.status ?? '?'}]  lang=${lang ?? '?'}  cat=${t.category ?? '?'}`);
    console.log(`    id: ${t.id ?? '(missing)'}`);
  }
  console.log('\nCopy an approved id into QONTAK_MESSAGE_TEMPLATE_ID in your .env\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err?.message ?? err);
  process.exit(1);
});
