mapbox-gl-round-drawer
========================

## Usage

```html
<script src='https://api.mapbox.com/mapbox-gl-js/v0.39.1/mapbox-gl.js'></script>
<script src='https://npmcdn.com/@turf/turf/turf.min.js'></script>
<script src="../../dist/index.js"></script>
```

### ES5

```js
mapboxgl.accessToken = '<token>';
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v9'
});

var roundDrawer = new window.RoundDrawer( window.turf );
map.addControl(roundDrawer);

map.on('round.update', (e) => {
  console.log(e);
  delete e.target;
  document.querySelector('#circle_geojson').value = JSON.stringify(e);
});
```

### ES6 (Webpack)

```js

const RoundDrawer = require('mapbox-gl-drawer');
const turf        = require('@turf/turf);

mapboxgl.accessToken = '<token>';
const map = new mapboxgl.Map({
  container: 'map',
  style    : 'mapbox://styles/mapbox/streets-v9'
});

const roundDrawer = new RoundDrawer( turf );
map.addControl(roundDrawer);

map.on('round.update', (e) => {
  console.log(e);
  delete e.target;
  document.querySelector('#circle_geojson').value = JSON.stringify(e);
  roundDrawer.dropRound();
});

roundDrawer.drawRound( map.getCenter() );

```

## Methods

### `drawRound( LnglatLike )`

- Arguments
    - `LnglatLike`: mapboxgl lnglatlike object
- Description: draw round


### `dropRound()`

- Description: drop round


### Events

#### `round.update`

event return:

- id
    - "mapbox-gl-round-drawer_{random string}"
    TODO
- roundCenter
- roundPolygon
- radius
- units

```json
{
  "id": "mapbox-gl-round-drawer_<random str>",
  "roundCenter": <Point Geojson>,
  "roundPolygon": <Polygon Geojson>,
  "radius": 11.422111367287327,
  "units": "kilometers",
  "type": "round.update"
}
```
