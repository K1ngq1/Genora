export async function GET() {
  return Response.json({
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    agnesConfigured: Boolean(process.env.AGNES_API_KEY?.trim()),
  });
}
