export const handler = async (event: any) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Hello from FMEA!',
      timestamp: new Date().toISOString(),
    }),
  };
};