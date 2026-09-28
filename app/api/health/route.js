export async function GET() {
  return Response.json({
    ok: true,
    service: "clinical-rd-intelligence",
    time: new Date().toISOString()
  });
}
