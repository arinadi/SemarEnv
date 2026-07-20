const https = require('https');
const fs = require('fs');
const path = require('path');

const APPS = [
  'nginx','mysql','mariadb','apache','memcached','redis',
  'mongodb','postgresql','java','composer','rabbitmq','python',
  'maven','mailpit','erlang','ruby','elasticsearch','minio',
  'rust','meilisearch','deno','bun','perl','consul','gradle',
  'zig','qdrant','etcd','tomcat','caddy','frankenphp',
  'zincsearch','mkcert','golang','php','swoole-cli','r-nacos'
];

function fetch(app) {
  return new Promise(resolve => {
    const body = JSON.stringify({ app, os: 'win', arch: 'x86' });
    const req = https.request({
      hostname: 'api.one-env.com', port: 443, path: '/api/version/fetch',
      method: 'POST', timeout: 8000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { const j = JSON.parse(d); resolve(j.code === 200 ? j.data || [] : []); }
        catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.write(body); req.end();
  });
}

(async () => {
  const result = {};
  for (let i = 0; i < APPS.length; i += 8) {
    const batch = APPS.slice(i, i + 8);
    const data = await Promise.all(batch.map(fetch));
    batch.forEach((app, j) => {
      result[app] = { win: { x86: data[j] } };
      console.log(`${app}: ${data[j].length} versions`);
    });
  }
  const out = path.join(__dirname, '..', 'static', 'versions.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result));
  console.log(`Done: ${out} (${Object.keys(result).length} apps)`);
})().catch(console.error);
