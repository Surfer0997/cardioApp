"use strict";

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputTemp = document.querySelector(".form__input--temp");
const inputClimb = document.querySelector(".form__input--climb");

const footerLink = document.querySelector(".footer__link");
const eraseAllBtn = document.querySelector(".erase__all--btn");
const seeAllBtn = document.querySelector(".see__all--btn");

const modalWindow = document.querySelector(".modal-window");
const overlay = document.querySelector(".overlay");
const btnCloseModalWindow = document.querySelector(".close-modal-window");

let markers = [];
let drawnItems = []; // maybe array?
let drawnLayer;
let redLayer;
const weatherAPI = "0fa9a420e6ee4f78a21102930221506";

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10); // usually uses outer libraries here its a piece of shit
  constructor(coords, distance, duration, weatherImgSrc, weatherString) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }
  _setDescription() {
    this.type === "running"
      ? (this.description = `Пробежка в ${
          this.weatherLocation
        } ${new Intl.DateTimeFormat("uk-UA").format(this.date)}`)
      : (this.description = `Велотренеровка в ${
          this.weatherLocation
        } ${new Intl.DateTimeFormat("uk-UA").format(this.date)}`);
  }
}

class Running extends Workout {
  type = "running";
  constructor(
    coords,
    distance,
    duration,
    temp,
    date,
    weatherImgSrc,
    weatherString,
    weatherResponse
  ) {
    super(
      coords,
      distance,
      duration,
      weatherImgSrc,
      weatherString,
      weatherResponse
    );
    this.temp = temp;
    if (date) this.date = new Date(date);
    this.calculatePace();
    // this._setDescription();
  }
  calculatePace() {
    // min/km
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = "cycling";
  constructor(
    coords,
    distance,
    duration,
    climb,
    date,
    weatherImgSrc,
    weatherString,
    weatherResponse
  ) {
    super(
      coords,
      distance,
      duration,
      weatherImgSrc,
      weatherString,
      weatherResponse
    );
    this.climb = climb;
    if (date) this.date = new Date(date);
    this.calulateSpeed();
    // this._setDescription();
  }
  calulateSpeed() {
    // km/h
    this.speed = (this.distance / this.duration) * 60; // * 60 to convert to hours
  }
}

class App {
  #map; // private field
  #mapEvent;
  #workouts = []; // array for objects

  constructor() {
    //// Getting user position
    this._getPosition(); // auto run when loaded
    //// Getting localstorage data
    this._getLocalStorageData();
    //// Event listeners
    form.addEventListener("submit", this._newWorkout.bind(this)); // this._newWorkout transfers form, not object app!!!! (eventListener), so we use bind
    inputType.addEventListener("change", this._toggleClimbField); // dropdown menu processings
    containerWorkouts.addEventListener(
      "click",
      this._containerProcessing.bind(this)
    ); // map moving on sidebar click
    footerLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.resetLocalStorage();
      alert("Local Storage cleared!");
    });
    eraseAllBtn.addEventListener("click", this._eraseAll.bind(this));
    seeAllBtn.addEventListener("click", this._seeAll.bind(this));
  }
  _seeAll() {
    const group = L.featureGroup(markers);
    this.#map.fitBounds(group.getBounds());
  }
  _containerProcessing(e) {
    if (e.target.classList.contains("delete__icon")) {
      const workoutElement = event.target.closest(".workout");
      const workout = this.#workouts.find(
        (item) => item.id === workoutElement.dataset.id
      ); // looking for an object with the same id html block has
      const workoutId = this.#workouts.indexOf(workout);
      if (!workoutElement) return; // guard close
      // Updating map marks
      this.#map.removeLayer(markers[workoutId]);
      markers.splice(workoutId, 1);
      // Deleting draw layer
      if (workout.redLayerForDeletion) {
        drawnItems.removeLayer(workout.layerId);
        drawnItems.removeLayer(workout.redLayerForDeletion);
      }

      // Updating an array
      this.#workouts.splice(workoutId, 1);
      workoutElement.remove();
      // Updating localStorage
      this._addWorkoutsToLocalStorage();
      if (!this.#workouts)
        document.querySelector(".btn-group").style.display = "none";
      return;
    }
    // edit button
    if (e.target.classList.contains("edit__icon")) {
      const workoutElement = e.target.closest(".workout");
      const workout = this.#workouts.find(
        (item) => item.id === workoutElement.dataset.id
      ); // looking for an object with the same id html block has
      const workoutId = this.#workouts.indexOf(workout);
      // form creation
      const editForm = form.cloneNode(true);
      editForm.classList.remove("hidden");
      editForm.classList.add("edit__form");
      e.target.closest(".workout").insertAdjacentElement("afterend", editForm);
      workoutElement.remove();
      // form processing
      const currentForm = document.querySelector(".edit__form");
      const inputClimb = currentForm.querySelector(".form__input--climb");
      const inputTemp = currentForm.querySelector(".form__input--temp");
      currentForm
        .querySelector(".form__input--type")
        .addEventListener("change", () => {
          inputClimb
            .closest(".form__row")
            .classList.toggle("form__row--hidden"); // looking for the closest parent (div form__row)
          inputTemp.closest(".form__row").classList.toggle("form__row--hidden");
        }); // dropdown menu processings

      editForm.addEventListener("submit", (e) => {
        e.preventDefault();
        // USING ARROW FUNCTION TO GIVE ACCESS TO THIS ON A HIGHER SCOPE
        const areNumbers = (...numbers) =>
          numbers.every((num) => Number.isFinite(num)); // getting boolean true only if every array item is number
        const arePositive = (...numbers) => numbers.every((num) => num > 0);

        ////// FORM PROCESSING
        // To get data from the form
        const type = currentForm.querySelector(".form__input--type").value; // type (see HTML select options)
        const distance = +currentForm.querySelector(".form__input--distance")
          .value; // + as Number()
        const duration = +currentForm.querySelector(".form__input--duration")
          .value;
        // If training is running, create object running
        if (type === "running") {
          const temp = +currentForm.querySelector(".form__input--temp").value;
          // Check data for validation
          if (
            !areNumbers(distance, duration, temp) ||
            !arePositive(distance, duration, temp)
          ) {
            showModal();
            return;
          }
          // Object creation

          this.#workouts[workoutId] = new Running(
            workout.coords,
            distance,
            duration,
            temp,
            workout.date,
            workout.id
          );
        }
        // If training is cycling, create object cycling
        if (type === "cycling") {
          const climb = +currentForm.querySelector(".form__input--climb").value; // Check data for validation
          if (
            !areNumbers(distance, duration, climb) ||
            !arePositive(distance, duration)
          )
            return alert("Enter positive number."); // guard close
          // Object creation
          this.#workouts[workoutId] = new Cycling(
            workout.coords,
            distance,
            duration,
            climb,
            workout.date,
            workout.id
          );
        }
        //// Adding weather API data
        this.#workouts[workoutId].weatherImgSrc = workout.weatherImgSrc;
        this.#workouts[workoutId].weatherString = workout.weatherString;
        this.#workouts[workoutId].weatherLocation = workout.weatherLocation;
        if (workout.layerId) {
          this.#workouts[workoutId].drawnLayer = workout.drawnLayer;
          this.#workouts[workoutId].layerId = workout.layerId;
          this.#workouts[workoutId].redLayerForDeletion =
            workout.redLayerForDeletion;
        }
        //// description
        this.#workouts[workoutId]._setDescription();
        // Display training on map
        this.#map.removeLayer(markers[workoutId]);
        markers.splice(workoutId, 1);
        this._displayWorkout(this.#workouts[workoutId], workoutId); // BUGBUGBUGBUGBUG
        // Display training at list
        this._displayWorkoutOnSidebar(this.#workouts[workoutId]);
        // Clear inputs and hide the form
        currentForm.remove();
        // Add all workouts to localstorage
        this._addWorkoutsToLocalStorage();
      });
    }
    this._moveToWorkout(e); // move to workout on map just cause we can
  }
  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this), // no brackets, only transferring function, no calling, bind to set this for usual function
        function () {
          alert("Cannot get your geolocation!");
        },
        { enableHighAccuracy: true }
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords; // destructuriztion :cool:
    const coords = [latitude, longitude];

    this.#map = L.map("map").setView(coords, 13); // 13 - map zoom

    const openstreet = L.tileLayer(
      "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(this.#map);
    const googleStreets = L.tileLayer(
      "http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }
    );
    const googleSat = L.tileLayer(
      "http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }
    );
    const baseMaps = {
      OSM: openstreet,
      "Google Street": googleStreets,
      "Google Satellite": googleSat,
    };
    L.control.layers(baseMaps).addTo(this.#map);
    /////////////////////////////////////////////////////////////////////////////////////////
    // FeatureGroup is to store editable layers
    drawnItems = new L.FeatureGroup();
    this.#map.addLayer(drawnItems);
    this.drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
        poly: false,
        marker: false,
        circle: false,
        edit: false,
        remove: false,
      },
      draw: {
        polygon: false,
        marker: false,
        circle: false,
        remove: false,
      },
    });

    this.#map.on(L.Draw.Event.CREATED, (e) => {
      this.#map.removeControl(this.drawControl);
      const type = e.layerType,
        layer = e.layer;
      drawnItems.addLayer(layer);
      const redLayerID = drawnItems.getLayerId(layer);

      drawnLayer = layer; // global layer adding

      ////// Gettieng 'center' coordinates
      // Rectangle
      if (layer instanceof L.Rectangle) {
        const point1Latlng = layer._latlngs[0][0];
        const point2Latlng = layer._latlngs[0][2];
        const lat = (point1Latlng.lat + point2Latlng.lat) / 2;
        const lng = (point1Latlng.lng + point2Latlng.lng) / 2;
        const latlng = { lat: lat, lng: lng };
        this._showForm({
          latlng: { lat: lat, lng: lng },
          redLayerForDeletion: redLayerID,
        });

        //// getting rectangle perimeter
        const coords = layer.getLatLngs();

        let length = 0;
        for (let i = 0; i < coords[0].length - 1; i++) {
          length += coords[0][i].distanceTo(coords[0][i + 1]);
        }
        length += coords[0][0].distanceTo(coords[0][3]);
        length = (length / 1000).toFixed(2);
        this._showForm({
          latlng: latlng,
          redLayerForDeletion: redLayerID,
          drawnItemLenght: length,
        });
      }
      // Circle
      if (layer instanceof L.Circle) {
        const latlng = { latlng: layer.getLatLng() };
        this._showForm({
          latlng: layer.getLatLng(),
          redLayerForDeletion: redLayerID,
        });
      }
      // Polyline
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        const latlng = {
          lat:
            (layer._latlngs[0].lat +
              layer._latlngs[layer._latlngs.length - 1].lat) /
            2,
          lng:
            (layer._latlngs[0].lng +
              layer._latlngs[layer._latlngs.length - 1].lng) /
            2,
        };
        //// getting polyline lenght
        const coords = layer.getLatLngs();

        let length = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          length += coords[i].distanceTo(coords[i + 1]);
        }
        length = (length / 1000).toFixed(2);

        this._showForm({
          latlng: latlng,
          redLayerForDeletion: redLayerID,
          drawnItemLenght: length,
        });
      }
    });

    this.#map.addControl(this.drawControl);

    /////////////////////////////////////////////////////////////////////////////////////
    //  Click on map processing
    this.#map.on("click", this._showForm.bind(this)); // acts as addEventListener
    /////////////////////////////////////////////////////////////////////////////////////
    // Toolbar use processing
    this.#map.on("draw:drawstart", (shapeData) => {
      const shape = shapeData.layerType;
      if (shape === "polyline") {
      }
      if (shape === "circle") {
      }
      if (shape === "rectangle") {
      }
    }); // acts as addEventListener
    // Displaying local stored data after map loading
    if (this.#workouts.length > 0)
      document.querySelector(".btn-group").style.display = "block";
    this.#workouts.forEach((workout) => {
      // displaying stored data
      this._displayWorkoutOnSidebar(workout);
      this._displayWorkout(workout);
    });
  }

  _showForm(event) {
    form.classList.remove("hidden");
    inputDistance.focus(); // cursor will be in this input
    if (isFinite(event[0])) {
      this.#mapEvent = {
        latlng: [event.lat, event.lng],
        redLayerForDeletion: event.redLayerForDeletion,
      };
    } else {
      this.#mapEvent = event;
      if (this.#mapEvent.drawnItemLenght) {
        inputDistance.value = this.#mapEvent.drawnItemLenght;
        inputDuration.focus();
      }
    }
  }

  _hideForm = function () {
    form.classList.add("hidden");
    inputDuration.value =
      inputTemp.value =
      inputClimb.value =
      inputDistance.value =
        "";
  };

  _toggleClimbField() {
    inputClimb.closest(".form__row").classList.toggle("form__row--hidden"); // looking for the closest parent (div form__row)
    inputTemp.closest(".form__row").classList.toggle("form__row--hidden");
  }

  async _newWorkout(e) {
    e.preventDefault();
    this.#map.addControl(this.drawControl);
    const areNumbers = (...numbers) =>
      numbers.every((num) => Number.isFinite(num)); // getting boolean true only if every array item is number
    const arePositive = (...numbers) => numbers.every((num) => num > 0);

    // coords getting
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;
    ////// FORM PROCESSING
    // To get data from the form
    const type = inputType.value; // type (see HTML select options)
    const distance = +inputDistance.value; // + as Number()
    const duration = +inputDuration.value;

    // If training is running, create object running
    if (type === "running") {
      const temp = +inputTemp.value;
      // Check data for validation
      if (
        !areNumbers(distance, duration, temp) ||
        !arePositive(distance, duration, temp)
      ) {
        showModal();
        return;
      } // guard close
      // Object cration
      workout = new Running([lat, lng], distance, duration, temp);
    }
    // If training is cycling, create object cycling
    if (type === "cycling") {
      const climb = +inputClimb.value;
      // Check data for validation
      if (
        !areNumbers(distance, duration, climb) ||
        !arePositive(distance, duration)
      ) {
        showModal();
        return;
      } // guard close
      // Object cration
      workout = new Cycling([lat, lng], distance, duration, climb);
    }
    try {
      const weatherResponse = await fetch(
        `http://api.weatherapi.com/v1/current.json?key=${weatherAPI}&q=${
          this.#mapEvent.latlng.lat
        }, ${this.#mapEvent.latlng.lng}&lang=uk`
      );
      const response = await weatherResponse;
      if (!response.ok) {
        throw new Error(
          `Нажаль не вдалося завантажити дані про погоду: код ${response.status}`
        );
      }

      const data = await response.json();
      workout.weatherImgSrc = `https://${data.current.condition.icon}`;
      workout.weatherString = `Була погода: ${data.current.condition.text}, ${data.current.temp_c} °C`;
      workout.weatherLocation = `${data.location.name}, ${data.location.region}`;
      ///////////// LEAFLET DRAW
      if (drawnLayer) {
        workout.drawnLayer = drawnLayer.toGeoJSON();
        //drawnItems.clearLayers(workout.drawnLayer);
        drawnLayer = "";
      }
    } catch (e) {
      workout.weatherImgSrc = `https://img.icons8.com/color/344/partly-cloudy-rain--v2.png`;
      workout.weatherString = `Нажаль не вдалося завантажити дані про погоду`;
      workout.weatherLocation = ``;
      console.error(`Виникла помилка: ${e.message}`);
    }
    ////// Descriptions
    workout._setDescription();
    workout.redLayerForDeletion = this.#mapEvent.redLayerForDeletion;

    // Add a new object to the trainings array
    this.#workouts.push(workout);

    // Display training on map
    this._displayWorkout(workout);
    // Display training at list
    this._displayWorkoutOnSidebar(workout);
    // Clear inputs and hide the form

    this._hideForm();

    // Add all workouts to localstorage
    this._addWorkoutsToLocalStorage();
  }

  _displayWorkout(workout, id) {
    /////// marker displaying

    const marker = L.marker(workout.coords)
      .addTo(this.#map) // [lat, lng] == workout.coords
      .bindPopup(
        L.popup({
          // popup options, see lefleat docs
          maxWidth: 200,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`, // type we get from HTML (select options names) // type == workout.type
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃" : "🚵‍♂️"} ${workout.description} <br>
        <img src="${workout.weatherImgSrc}" class="weather__img" alt=""> ${
          workout.weatherString
        } `
      ) // popup method, leaflet docs
      .openPopup();
    // pushing to global markers array
    if (document.querySelector(".edit__form")) {
      markers.splice(id, 0, marker); // inserting back edited marker
      return;
    }
    markers.push(marker);

    /// displaying leaflet.draw
    if (workout.drawnLayer) {
      const layer = L.geoJSON(workout.drawnLayer);
      drawnItems.addLayer(layer);

      workout.layerId = drawnItems.getLayerId(layer);
      this.#map.removeLayer(drawnItems);
      this.#map.addLayer(drawnItems);
      // drawnItems.addTo(this.#map);
    }
  }

  _displayWorkoutOnSidebar(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
          <h2 class="workout__title">${workout.description} 
          <img src="${workout.weatherImgSrc}" class="weather__img" alt=""> ${
      workout.weatherString
    } 
          	<span class="workout__control--icon delete__icon">❌</span>
          	<span class="workout__control--icon edit__icon">✏️</span>
          </h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === "running" ? "🏃" : "🚵‍♂️"
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">км</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">мин</span>
          </div>`; // same part
    if (workout.type === "running") {
      html += `<div class="workout__details">
            <span class="workout__icon">📏⏱</span>
            <span class="workout__value">${workout.pace.toFixed(2)}</span>
            <span class="workout__unit">мин/км</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">👟⏱</span>
            <span class="workout__value">${workout.temp}</span>
            <span class="workout__unit">шаг/мин</span>
          </div>
        </li>`;
    }
    if (workout.type === "cycling") {
      html += `<div class="workout__details">
            <span class="workout__icon">📏⏱</span>
            <span class="workout__value">${workout.speed.toFixed(2)}</span>
            <span class="workout__unit">км/ч</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🏔</span>
            <span class="workout__value">${workout.climb}</span>
            <span class="workout__unit">м</span>
          </div>
        </li>`;
    }

    // html insertion
    if (document.querySelector(".edit__form")) {
      document
        .querySelector(".edit__form")
        .insertAdjacentHTML("afterend", html);
      return;
    }
    form.insertAdjacentHTML("afterend", html);
    document.querySelector(".btn-group").style.display = "block";

    // event listeners
  }

  _moveToWorkout(event) {
    // event delegation
    const workoutElement = event.target.closest(".workout");
    if (!workoutElement) return; // guard close

    const workout = this.#workouts.find(
      (item) => item.id === workoutElement.dataset.id
    ); // looking for an object with the same id html block has
    this.#map.setView(workout.coords, 13, {
      animate: true,
      pan: {
        duration: 1,
      },
    }); // moving map to position (coords, zoom, {options})
  }

  _addWorkoutsToLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }
  _getLocalStorageData() {
    const data = JSON.parse(localStorage.getItem("workouts"));
    if (!data) return; // guard close
    // converting to Running / Cycling objects
    let recombinedData = [];
    data.forEach((item, id) => {
      if (item.type === "running") {
        recombinedData.push(
          new Running(item.coords, item.distance, item.duration, item.temp)
        );
      }
      if (item.type === "cycling") {
        recombinedData.push(
          new Cycling(item.coords, item.distance, item.duration, item.climb)
        );
      }
      recombinedData[id].date = new Date(item.date);
      recombinedData[id].id = item.id;
      recombinedData[id].weatherImgSrc = item.weatherImgSrc;
      recombinedData[id].weatherString = item.weatherString;
      recombinedData[id].weatherLocation = item.weatherLocation;
      recombinedData[id].description = item.description;
      if (item.drawnLayer) {
        recombinedData[id].drawnLayer = item.drawnLayer;
        recombinedData[id].redLayerForDeletion = item.redLayerForDeletion;
      }
    });

    this.#workouts = recombinedData; // inputing to objects array
  }
  _eraseAll() {
    this.#workouts = [];
    markers.forEach((marker) => this.#map.removeLayer(marker));
    markers = [];
    document
      .querySelectorAll(".workout")
      .forEach((workout) => workout.remove());
    this.resetLocalStorage();
    document.querySelector(".btn-group").style.display = "none";
    drawnItems.clearLayers();
  }
  resetLocalStorage() {
    localStorage.removeItem("workouts");
  }
}

const app = new App();

/////////// Modal window
function closeModal() {
  modalWindow.classList.add("hidden");
  overlay.classList.add("hidden");
}
function showModal() {
  modalWindow.classList.remove("hidden");
  overlay.classList.remove("hidden");
}

btnCloseModalWindow.addEventListener("click", closeModal);
overlay.addEventListener("click", closeModal);

document.addEventListener("keydown", function (e) {
  if (e.code === "Escape" && !modalWindow.classList.contains("hidden")) {
    closeModal();
  }
});
