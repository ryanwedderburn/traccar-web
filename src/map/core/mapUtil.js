import { parse, stringify } from 'wellknown';
import turfCircle from '@turf/circle';
import gcoord from 'gcoord';
import { map } from './MapView';

const coordinateSystem = (id) => {
  switch (id) {
    case 'gcj02':
      return gcoord.GCJ02;
    default:
      return gcoord.WGS84;
  }
};

export const toMapCoordinates = (longitude, latitude) =>
  map.coordinateSystem
    ? gcoord.transform([longitude, latitude], gcoord.WGS84, coordinateSystem(map.coordinateSystem))
    : [longitude, latitude];

export const fromMapCoordinates = (longitude, latitude) =>
  map.coordinateSystem
    ? gcoord.transform([longitude, latitude], coordinateSystem(map.coordinateSystem), gcoord.WGS84)
    : [longitude, latitude];

const transformGeometry = (geometry, from, to) => ({
  ...geometry,
  coordinates: gcoord.transform(structuredClone(geometry.coordinates), from, to),
});

export const loadImage = (url) =>
  new Promise((imageLoaded) => {
    const image = new Image();
    image.onload = () => imageLoaded(image);
    /* A missing brand logo must not stall preloading the map: resolve with an empty image. */
    image.onerror = () => imageLoaded(image);
    image.src = url;
  });

/**
 * OURS - a brand marker: the logo in its own colours on a white badge with a soft shadow, like the round
 * markers, and the status as a small dot on the corner rather than a frame (Ryan, 9 Oct: the red borders
 * were "a bit rough"). Wide rather than round, so a wordmark (Sherco, Rieju) stays readable at map size.
 */
export const prepareBrandIcon = (logo, color) => {
  const margin = 4;
  const badgeWidth = 68;
  const badgeHeight = 30;
  const width = badgeWidth + 2 * margin;
  const height = badgeHeight + 2 * margin;
  const pad = 4;
  const ratio = devicePixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.35)';
  context.shadowBlur = 3;
  context.shadowOffsetY = 0.5;
  context.beginPath();
  context.roundRect(margin, margin, badgeWidth, badgeHeight, 7);
  context.fillStyle = 'white';
  context.fill();
  context.restore();

  const boxWidth = badgeWidth - 2 * pad;
  const boxHeight = badgeHeight - 2 * pad;
  const scale = Math.min(boxWidth / logo.width, boxHeight / logo.height);
  const drawWidth = logo.width * scale;
  const drawHeight = logo.height * scale;
  context.drawImage(
    logo,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const dotX = margin + badgeWidth - 2;
  const dotY = margin + 2;
  context.beginPath();
  context.arc(dotX, dotY, 4.5, 0, 2 * Math.PI);
  context.fillStyle = 'white';
  context.fill();
  context.beginPath();
  context.arc(dotX, dotY, 3.2, 0, 2 * Math.PI);
  context.fillStyle = color;
  context.fill();

  return context.getImageData(0, 0, canvas.width, canvas.height);
};

const canvasTintImage = (image, color) => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width * devicePixelRatio;
  canvas.height = image.height * devicePixelRatio;
  canvas.style.width = `${image.width}px`;
  canvas.style.height = `${image.height}px`;

  const context = canvas.getContext('2d');

  context.save();
  context.fillStyle = color;
  context.globalAlpha = 1;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-atop';
  context.globalAlpha = 1;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.restore();

  return canvas;
};

export const prepareIcon = (background, icon, color) => {
  const canvas = document.createElement('canvas');
  canvas.width = background.width * devicePixelRatio;
  canvas.height = background.height * devicePixelRatio;
  canvas.style.width = `${background.width}px`;
  canvas.style.height = `${background.height}px`;

  const context = canvas.getContext('2d');
  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  if (icon) {
    const iconRatio = 0.5;
    const imageWidth = canvas.width * iconRatio;
    const imageHeight = canvas.height * iconRatio;
    context.drawImage(
      canvasTintImage(icon, color),
      (canvas.width - imageWidth) / 2,
      (canvas.height - imageHeight) / 2,
      imageWidth,
      imageHeight,
    );
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
};

export const reverseCoordinates = (it) => {
  if (!it) {
    return it;
  }
  if (Array.isArray(it)) {
    if (it.length === 2 && typeof it[0] === 'number' && typeof it[1] === 'number') {
      return [it[1], it[0]];
    }
    return it.map((it) => reverseCoordinates(it));
  }
  return {
    ...it,
    coordinates: reverseCoordinates(it.coordinates),
  };
};

export const geofenceToFeature = (theme, item) => {
  let geometry;
  if (item.area.indexOf('CIRCLE') > -1) {
    const coordinates = item.area
      .replace(/CIRCLE|\(|\)|,/g, ' ')
      .trim()
      .split(/ +/);
    const options = { steps: 32, units: 'meters' };
    const polygon = turfCircle(
      toMapCoordinates(Number(coordinates[1]), Number(coordinates[0])),
      Number(coordinates[2]),
      options,
    );
    geometry = polygon.geometry;
  } else {
    geometry = reverseCoordinates(parse(item.area));
    if (map.coordinateSystem) {
      geometry = transformGeometry(geometry, gcoord.WGS84, coordinateSystem(map.coordinateSystem));
    }
  }
  return {
    id: item.id,
    type: 'Feature',
    geometry,
    properties: {
      name: item.name,
      color: item.attributes.color || theme.palette.geometry.main,
      width: item.attributes.mapLineWidth || 2,
      opacity: item.attributes.mapLineOpacity || 1,
    },
  };
};

export const geometryToArea = (geometry) => {
  const normalized = map.coordinateSystem
    ? transformGeometry(geometry, coordinateSystem(map.coordinateSystem), gcoord.WGS84)
    : geometry;
  return stringify(reverseCoordinates(normalized));
};

export const findFonts = (map) => {
  const { glyphs } = map.getStyle();
  if (glyphs.startsWith('https://tiles.openfreemap.org')) {
    return ['Noto Sans Regular'];
  }
  return ['Open Sans Regular', 'Arial Unicode MS Regular'];
};
