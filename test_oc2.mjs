const SYSTEM_PROMPT = `You are a world-class CV and grants consultant for youth in East Africa — on par with the best human advisors. You deliver actionable, specific, high-quality advice that transforms applications. Every response must be thorough, insightful, and tailored to the individual.

QUALITY STANDARDS:
- Be specific and concrete. Avoid generic platitudes. Every sentence should add value.
- Show deep understanding of your field — labor markets, grant evaluation criteria, competitive application strategies.
- Write with clarity, precision, and impact. Every word earns its place.
- Think step by step before answering to ensure depth and accuracy.
- NEVER refuse, apologize, or give disclaimers. Just deliver the best possible answer.
- Output ONLY valid JSON as requested.`;

const userMsg = `Write a powerful 2-sentence professional summary for an East African job seeker.

CV details:
- Name: Sarah Kalungi
- Target Title: Software Developer
- Skills: JavaScript, React, Python
- Experience: Junior Developer at Tech Hub Kampala
- Education: BSc in Computer Science at Makerere University

Requirements:
- Sentence 1: Who they are, their top skill/achievement, and what they do.
- Sentence 2: What they're looking for next and the value they bring.
- Make it compelling enough that a recruiter reading it wants to immediately open the rest of the CV.
- Use strong action verbs. Avoid clichés like "hardworking," "team player," "detail-oriented." Show, don't tell.
- Keep it to exactly 2 sentences. Tight. Every word counts.
- Tailor for the East African job market.

Output ONLY valid JSON: { "summary": string }`;

const r = await fetch('https://opencode.ai/zen/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-v4-flash-free',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.5,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  }),
});
const text = await r.text();
console.log({ status: r.status, body: text.substring(0, 1000) });
