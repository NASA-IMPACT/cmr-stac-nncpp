const cmr = require('../cmr');
const settings = require('../settings');
const { wfs, generateAppUrl, makeCmrSearchUrl } = require('../util');
const {
  WHOLE_WORLD_BBOX,
  pointStringToPoints,
  parseOrdinateString,
  addPointsToBbox,
  mergeBoxes,
  reorderBoxValues
} = require('./bounding-box');

function cmrCollSpatialToExtents (cmrColl) {
  let bbox = null;
  if (cmrColl.polygons) {
    bbox = cmrColl.polygons
      .map((rings) => rings[0])
      .map(pointStringToPoints)
      .reduce(addPointsToBbox, bbox);
  } else if (cmrColl.points) {
    const points = cmrColl.points.map(parseOrdinateString);
    const orderedPoints = points.map(([lat, lon]) => [lon, lat]);
    bbox = addPointsToBbox(bbox, orderedPoints);
  } else if (cmrColl.lines) {
    const linePoints = cmrColl.lines.map(parseOrdinateString);
    const orderedLines = linePoints.map(reorderBoxValues);
    bbox = orderedLines.reduce((box, line) => mergeBoxes(box, line), bbox);
  } else if (cmrColl.boxes) {
    bbox = cmrColl.boxes
      .reduce((box, boxStr) => mergeBoxes(
        box,
        reorderBoxValues(parseOrdinateString(boxStr))), bbox);
  } else {
    // whole world bbox
    bbox = WHOLE_WORLD_BBOX;
  }
  return bbox;
}

function createExtent (cmrCollection) {
  return {
    spatial: { bbox: [cmrCollSpatialToExtents(cmrCollection)] },
    temporal: {
      interval: [
        [
          cmrCollection.time_start,
          (cmrCollection.time_end || null)
        ]
      ]
    }
  };
}

function createLinks (event, cmrCollection, cmrUrl) {
  const provider = cmrCollection.data_center;

  const links = [
    // wfs.createLink('self', generateAppUrl(event, `/${provider}/collections/${cmrCollection.stacId}`),
    //   'Info about this collection'),
    // wfs.createLink('root', generateAppUrl(event, ''),
    //   'Root catalog'),
    // wfs.createLink('parent', generateAppUrl(event, `/${provider}`),
    //   'Parent catalog'),
    wfs.createLink('items', makeCmrSearchUrl(cmrUrl, `/granules.umm_json?short_name=${cmrCollection.short_name}`),
      'Granules in this collection'),
    wfs.createLink('about', makeCmrSearchUrl(cmrUrl, `/concepts/${cmrCollection.id}.html`),
      'HTML metadata for collection'),
    wfs.createLink('via', makeCmrSearchUrl(cmrUrl, `/concepts/${cmrCollection.id}.json`),
      'CMR JSON metadata for collection')
  ];
  return links;
}

function cmrCollToWFSColl (event, cmrCollection, cmrUrl) {
  if (!cmrCollection) return [];
  const stacId = cmr.cmrCollectionToStacId(cmrCollection.short_name, cmrCollection.version_id);
  cmrCollection.stacId = stacId;
  const collection = {
    id: stacId,
    stac_version: settings.stac.version,
    license: cmrCollection.license || 'not-provided',
    title: cmrCollection.dataset_id,
    type: 'Collection',
    description: cmrCollection.summary,
    links: createLinks(event, cmrCollection, cmrUrl),
    extent: createExtent(cmrCollection)
  };
  return collection;
}

module.exports = {
  cmrCollSpatialToExtents,
  cmrCollToWFSColl
};
