/* eslint-disable camelcase */
const Shopify = require('shopify-api-node');
const fs = require('fs');
const util = require('util');
const Handlebars = require('handlebars');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
let template;

export const shopify = new Shopify({
  shopName: 'SHOP-NAME',
  apiKey: 'API-KEY',
  password: 'API-PASSWORD',
  apiVersion: '2020-01'
});

shopify.on('callLimits', (limits) => console.log(limits));

/**
 * Read the file template for the map
 */
const readTemplate = async () => {
  const data = await readFile('map-template.html', 'utf8');
  template = Handlebars.compile(data);
};

/**
 * Build marker for Google map
 * @param {*} lat
 * @param {*} lon
 * @param {*} description
 * @param {*} title
 * @param {*} uid
 */
const buildMarker = (lat, lon, description, title, uid) => {
  const descriptionEscaped = description.replace(/'/g, '&apos;');
  const titleEscaped = title.replace(/'/g, '&apos;');
  const markerPlace = `{ lat: ${lat}, lng: ${lon} }`;
  const contentString = `<div id="content"><div id="siteNotice"></div><h1 id="firstHeading" class="firstHeading">${titleEscaped}</h1><div id="bodyContent"><p>${descriptionEscaped}</p>`;
  const infowindow = `const infowindow${uid} = new google.maps.InfoWindow({ content: '${contentString}' });`;
  const marker = `const marker${uid} = new google.maps.Marker({ position: ${markerPlace}, map, title: '${titleEscaped}', storeId: 'marker${uid}' });`; // add a label? label: 'hum'
  const listener = `marker${uid}.addListener('click', () => { infowindow${uid}.open(map, marker${uid}); });`;
  return `${infowindow}\n${marker}\n${listener}\n\n`;
};

/**
 * Get Orders from shopify API
 */
const getOrders = async () => {
  let params = { limit: 50, status: 'any' };
  let total = 0;
  let markers = '';
  let markersArray = 'const markers = [';
  const generated = new Date().toString();
  let ordersMap = 'const ordersMap =';
  const ordersM = new Map();

  do {
    const orders = await shopify.order.list(params);

    /**
     * Build HTML popup for every orders
     */
    for (const order of orders) {
      if (
        order.shipping_address &&
        order.shipping_address.latitude &&
        order.shipping_address.longitude
      ) {
        markers += buildMarker(
          order.shipping_address.latitude,
          order.shipping_address.longitude,
          `${order.order_number}<br/>Email: ${order.email}<br/>Date: ${order.created_at}<br/>Address: ${order.shipping_address}`,
          `${order.shipping_address.first_name}, ${order.shipping_address.last_name}`,
          order.order_number
        );
        markersArray += `marker${order.order_number}, `;
        ordersM[`marker${order.order_number}`] = order;
      }
    }
    params = orders.nextPageParameters;
    total += orders.length;
  } while (params !== undefined);

  markersArray = `${markersArray.substr(0, markersArray.length - 2)} ];`;
  ordersMap += `${JSON.stringify(ordersM)} ;`;
  ordersMap += ' ;';

  console.log(`total orders: ${total}`);
  const contents = template({
    markers,
    markersArray,
    generated,
    ordersMap,
  });
  await writeFile('output/map.html', contents);
};

(async () => {
  await readTemplate();
  await getOrders();
  console.log('done generating map.html!');
})().catch(console.error);
