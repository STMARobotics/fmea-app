import {
  findFmeaById,
  formatFmeaEntry,
  getPathParameter,
  jsonResponse,
  readFmea,
  type HttpEvent,
} from './fmea-utils';

export const handler = async (event: HttpEvent) => {
  const fmeaId = getPathParameter(event, 'fmeaId');
  if (!fmeaId) {
    return jsonResponse(400, { message: 'An FMEA ID is required.' });
  }

  try {
    const item = await findFmeaById(fmeaId);
    if (!item) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }
    return jsonResponse(200, await formatFmeaEntry(readFmea(item)));
  } catch (error) {
    console.error('Failed to load FMEA entry from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load FMEA item.' });
  }
};
