import https from 'https';
import http from 'http';

export function extractText(fileUrl) {
  return new Promise((resolve, reject) => {
    const fetcher = fileUrl.startsWith('https') ? https : http;
    fetcher.get(fileUrl, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch: ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const data = await pdfParse(buffer);
          resolve(data.text);
        } catch {
          resolve(buffer.toString('utf-8'));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}
