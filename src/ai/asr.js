const RPCClient = require('@alicloud/pop-core').RPCClient;
const https = require('https');

const AK = process.env.ALIYUN_ACCESS_KEY || '';
const SK = process.env.ALIYUN_SECRET || '';
const APP_KEY = process.env.ALIYUN_APP_KEY || '';

const client = new RPCClient({
  accessKeyId: AK,
  accessKeySecret: SK,
  endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
  apiVersion: '2019-02-28'
});

async function getToken() {
  const result = await client.request('CreateToken');
  return result.Token.Id;
}

async function recognize(buf) {
  const token = await getToken();
  return new Promise((ok, bad) => {
    const options = {
      hostname: 'nls-gateway-cn-shanghai.aliyuncs.com',
      path: '/stream/v1/asr?appkey=' + APP_KEY + '&format=m4a&sample_rate=16000',
      method: 'POST',
      headers: {
        'X-NLS-Token': token,
        'Content-Type': 'application/octet-stream',
        'Content-Length': buf.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.result) ok(parsed.result);
          else bad(new Error('ASR: ' + (parsed.error_message || data)));
        } catch (e) { ok(''); }
      });
    });
    req.on('error', bad);
    req.write(buf);
    req.end();
  });
}

module.exports = { recognize };
