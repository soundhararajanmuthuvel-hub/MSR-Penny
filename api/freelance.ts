// Vercel Serverless Function: /api/freelance
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'DELETE') {
    return res.status(200).json({ success: true, message: 'Freelance job deleted' });
  }

  return res.status(200).json({
    success: true,
    job: req.body || null,
  });
}
