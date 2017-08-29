(() => {
  const turf = require('@turf/turf');
  const randStr = (len = 32) => {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < len; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  };

  const _detect = (val) => {
    return Object.prototype.toString.call(val).replace(/\[object\s([^\]]+)\]/, '$1');
  };
  const isObject = val => _detect(val).toLowerCase() === 'object';
  const isArray = val => _detect(val).toLowerCase() === 'array';

  const empty = { type: 'FeatureCollection', features: [] };

  class RoundDrawer {
    constructor(options = {}) {
      const self = this;
      self._id = randStr();

      self._options = {};
      self._geojson = {
        circle: empty,
        round: empty
      };
      self._data = {
        currentRadius: 0
      };
      self._eventFuncs = {};

      self._initOptions(options);
    }

    getDrawerId() {
      return `mapbox-gl-round-drawer_${this._id}`;
    }

    // required
    onAdd(map) {
      const self = this;
      self._map = map;
      self._container = document.createElement('div');
      let className = self.getDrawerId();
      if (self._options.controlHTML) {
        className += ' mapboxgl-ctrl mapboxgl-ctrl mapboxgl-ctrl-group';
        self._container.innerHTML = self._options.controlHTML;
      }
      self._container.className = className;
      return self._container;
    }

    // required?
    onRemove() {
      const self = this;
      self._container.parentNode.removeChild(self._container);
      this._map = undefined;
    }

    getMap() {
      return this._map;
    }

    _initOptions(options) {
      const self = this;
      self._defaultOptions = {
        controlHTML: '',
        radius: 1,
        steps: 64,
        units: 'kilometers'
      };
      const _options = Object.assign({}, self._defaultOptions, options);
      self._options = _options;
    }

    _initDrawRoundMap() {
      const self = this;
      if (self._initDrawRoundMapStatus) {
        return;
      }
      const map = self.getMap();
      const drawerId = self.getDrawerId();
      map.addSource(`center-${drawerId}`, {
        type: 'geojson',
        data: empty
      });
      map.addLayer({
        id: `center-${drawerId}`,
        source: `center-${drawerId}`,
        type: 'circle',
        paint: {
          'circle-color': 'rgba(255,0,0,.6)',
          'circle-radius': 6
        }
      });
      map.addSource(drawerId, {
        type: 'geojson',
        data: empty
      });
      map.addLayer({
        id: `line-${drawerId}`,
        source: drawerId,
        type: 'line',
        paint: {
          'line-color': 'rgba(255,0,0,.6)',
          'line-width': 2
        }
      });
      map.addLayer({
        id: `fill-${drawerId}`,
        source: drawerId,
        type: 'fill',
        paint: {
          'fill-color': 'rgba(255,0,0,.2)',
        }
      });
      this._initDrawRoundMapStatus = true;
      this._initMapEvent();
    }
    _initMapEvent() {
      const self = this;
      const map = self.getMap();
      const drawerId = self.getDrawerId();
      map.dragPan.disable();
      map.dragPan.enable();

      // TODO: 円形領域の描画が更新された時にイベント発火 (mapbox-gl-drawのように)

      // 円形領域の中心に関するイベント
      let mouseDownRoundCenter = false;
      self._eventFuncs.mouseMoveEv = (e) => {
        // console.log('mouseMove');
        const features = map.queryRenderedFeatures(e.point, { layers: [`center-${drawerId}`] });
        const hasFeature = !!features.length;
        // console.log('hasFeature', hasFeature);
        map.getCanvasContainer().style.cursor = hasFeature ? 'pointer' : '';
        if (mouseDownRoundCenter) {
          // console.log('latestCenter', e);
          const latestCenter = turf.point([e.lngLat.lng, e.lngLat.lat]);
          self.setCenter(latestCenter);
          const latestRound = self.genCircle(latestCenter, self._data.currentRadius);
          self.setRound(latestRound);
          const latestDrgPoint = self.genDestination(latestCenter, self._data.currentRadius);
          self.setDrgPoint(latestDrgPoint);
        }
        // console.log('mouseMoveEnd');
      };
      map.on('mousemove', self._eventFuncs.mouseMoveEv);

      self._eventFuncs.mouseDownEv = (e) => {
        // console.log('mouseDown');
        const features = map.queryRenderedFeatures(e.point, { layers: [`center-${drawerId}`] });
        const hasFeature = !!features.length;
        if (!hasFeature) return;
        map.dragPan.disable();
        mouseDownRoundCenter = hasFeature;
        // console.log('mouseDownEnd');
      };
      map.on('mousedown', self._eventFuncs.mouseDownEv);

      // let roundUpdateTimer = null;
      self._eventFuncs.mouseUpEv = (e) => {
        // console.log('mouseUp');
        if (mouseDownRoundCenter) {
          mouseDownRoundCenter = false;
          map.dragPan.enable();
          self.fireRoundUpdate();
        }
      };
      map.on('mouseup', self._eventFuncs.mouseUpEv);
      // 円形領域の中心に関するイベント/ここまで
    }
    // _dropMapEvent() {
    //   const self = this;
    //   const map = self.getMap();
    //   map.off('mousemove', self._eventFuncs.mouseMoveEv);
    //   map.off('mousedown', self._eventFuncs.mouseDownEv);
    //   map.off('mouseup', self._eventFuncs.mouseUpEv);
    // }

    fireRoundUpdate() {
      const self = this;
      const map = self.getMap();
      map.fire('round.update', {
        id: self.getDrawerId(),
        roundCenter : self.getRoundCenter(),
        roundPolygon: self.getRound(),
        radius: self.getRadius(),
        units: self._options.units
      });
    }

    drawRound(centerLngLatLike) {
      const self = this;
      self._initDrawRoundMap();
      const map = self.getMap();
      if (!centerLngLatLike) throw new Error('requried lngLatLike');
      const centerLngLat = map.unproject(map.project(centerLngLatLike));
      const drawerId = self.getDrawerId();
      self.setCenter(turf.point([centerLngLat.lng, centerLngLat.lat]));

      // TODO: defaultの半径は、 0 ~ canvasの高さ を map.projcet でpointにして、距離を計算して利用する
      const bounds = map.getBounds();
      // const top = bounds.sw.lat, bounds.ne.lat
      // console.log('bounds', bounds);
      const hr1 = [Math.max.apply(null, [bounds._sw.lng, bounds._ne.lng]), Math.max.apply(null, [bounds._sw.lat, bounds._ne.lat])];
      const hr2 = [Math.min.apply(null, [bounds._sw.lng, bounds._ne.lng]), Math.max.apply(null, [bounds._sw.lat, bounds._ne.lat])];
      const hrDistance = turf.distance(hr1, hr2); // lm

      const vr1 = [Math.max.apply(null, [bounds._sw.lng, bounds._ne.lng]), Math.max.apply(null, [bounds._sw.lat, bounds._ne.lat])];
      const vr2 = [Math.max.apply(null, [bounds._sw.lng, bounds._ne.lng]), Math.min.apply(null, [bounds._sw.lat, bounds._ne.lat])];
      const vrDistance = turf.distance(vr1, vr2);

      // set initial radius
      self._data.currentRadius = Math.min.apply(null, [hrDistance, vrDistance]) / 3 / 2;

      const roundPoly = turf.circle(
        turf.point([centerLngLat.lng, centerLngLat.lat]),
        // TODO: default, 領域に収まるサイズ
        // self._options.radius / self.getMap().getZoom(),
        self._data.currentRadius,
        self._options.steps,
        self._options.units
      );
      // map.getSource(drawId).setData(roundPoly);
      self.setRound(roundPoly);

      // draggable circle
      let drgEl = document.createElement('div');
      drgEl.style.width = '12px';
      drgEl.style.height = '12px';
      drgEl.style.borderRadius = '50%';
      drgEl.style.cursor = 'pointer';
      drgEl.style.backgroundColor = 'rgba(255,0,0,.6)';

      let drgElMousedown = false;
      let dragStartScreenX = null;
      let firstDragPoint = null;
      const mouseDownEv = (e) => {
        // console.log('mousedown', e);
        dragStartScreenX = e.screenX;
        map.dragPan.disable();
        drgElMousedown = true;
        firstDragPoint = self.getDrgPoint();
      };
      let xDiff = 0;
      const mouseMovingEv = (e) => {
        if (drgElMousedown) {
          // console.log('mousemoving', e);
          // console.log('self._geojson.drgPoint', self._geojson.drgPoint);
          xDiff = e.screenX - dragStartScreenX;
          // console.log(xDiff);
          const latestRadius = self._getRadiusFromXDiff(xDiff, firstDragPoint);
          // self.setRoundRadius(latestRadius);
          const roundCenter = self.getRoundCenter();
          const latestRound = self.genCircle(roundCenter, latestRadius);
          self.setRound(latestRound);
          self._data.currentRadius = latestRadius;
          const drgPoint = self.genDestination(roundCenter, latestRadius);
          self.setDrgPoint(drgPoint);
        }
      };
      const mouseUpEv = (e) => {
        if (drgElMousedown) {
          // console.log('mouseup', e);
          map.dragPan.enable();
          drgElMousedown = false;
          firstDragPoint = null;
          self.fireRoundUpdate();
        }
      };
      drgEl.addEventListener('mousedown', mouseDownEv);
      document.addEventListener('mousemove', mouseMovingEv);
      document.addEventListener('mouseup', mouseUpEv);
      // let dragStartPoint = null;
      // drgEl.addEventListener('dragstart', (e) => {
      //   console.log('dragstart', e);
      //   dragStartPoint = e.point;
      // });
      // drgEl.addEventListener('dragend', (e) => {
      //   console.log('dragend', e);
      //   dragStartPoint = null;
      // });
      // drgEl.addEventListener('drag', (e) => {
      //   console.log('drag', e);
      // });

      self._geojson.drgPoint = turf.destination(
        self.getRoundCenter(),
        self._data.currentRadius,
        90,
        self._options.units
      );
      self._drgMarker = new window.mapboxgl.Marker(drgEl)
        // .setLngLat(centerLngLat)
        .setLngLat(self._geojson.drgPoint.geometry.coordinates)
        .addTo(map);
      self.fireRoundUpdate();
    }
    
    _getRadiusFromXDiff(xDiff, firstDragPoint) {
      const self = this;
      const map = self.getMap();
      // console.log('self.getDrgPoint()',self.getDrgPoint());
      const drgPoint = map.project(firstDragPoint.geometry.coordinates);
      // console.log('drgPoint', drgPoint);
      drgPoint.x += xDiff;
      // console.log('after drgPoint', drgPoint);
      const drgPointData = map.unproject(drgPoint);
      const centerPointData = self.getRoundCenter();
      return turf.distance(centerPointData, turf.point([drgPointData.lng, drgPointData.lat]), self._options.units);
    }
    setRound(geojson) {
      const self = this;
      const map = self.getMap();
      self._geojson.round = geojson;
      map.getSource(self.getDrawerId()).setData(self._geojson.round);
    }
    setCenter(geojson) {
      const self = this;
      const map = self.getMap();
      self._geojson.center = geojson;
      map.getSource('center-' + self.getDrawerId()).setData(self._geojson.center);
    }
    getRound() {
      const self = this;
      return JSON.parse(JSON.stringify(self._geojson.round));
    }
    getRoundCenter() {
      const self = this;
      return JSON.parse(JSON.stringify(self._geojson.center));
    }
    getDrgPoint() {
      const self = this;
      return JSON.parse(JSON.stringify(self._geojson.drgPoint));
    }
    setDrgPoint(geojson) {
      const self = this;
      self._geojson.drgPoint = geojson;
      self._drgMarker.setLngLat(geojson.geometry.coordinates);
    }
    dropRound() {
      const self = this;
      const map = self.getMap();
      const drawerId = self.getDrawerId();
      if (map.getSource(drawerId)) {
        map.getSource(drawerId).setData(empty);
      }
      self.setRound(empty);
      self._geojson.round = null;
      self.setCenter(empty);
      self._geojson.center = null;
      self._drgMarker.remove();
      // self._dropMapEvent();
    }

    getRadius() {
      return this._data.currentRadius;
    }

    genCircle(center, radius) {
      const self = this;
      return turf.circle(center, radius, self._options.steps, self._options.units);
    }
    genDestination(origin, distance) {
      const self = this;
      return turf.destination(origin, distance, 90, self._options.units);
    }

  }

  // window.RoundDrawer = RoundDrawer;

  // console.log(RoundDrawer);
  // console.log(window);
  // console.log('global', global);

  if (window) {
    // console.log('window?');
    window.RoundDrawer = RoundDrawer;
  } else if (typeof module !== 'undefined' && module.exports) {
    // console.log('module.exports ? ');
    module.exports = RoundDrawer;
  } else  {
    // console.log('else?');
  }
  // console.log('hoge');
})();