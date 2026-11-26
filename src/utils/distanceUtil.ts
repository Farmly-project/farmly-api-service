const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Tính khoảng cách đường chim bay theo công thức Haversine (đơn vị: km)
 */
export const calculateHaversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const EARTH_RADIUS_KM = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Number(distance.toFixed(2));
};
