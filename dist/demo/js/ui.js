import store from './ui_state/store/index.js';
import MorphologiesList from './ui_state/components/morphologies_list.js';
import AgentsList from './ui_state/components/agents_list.js';
import AgentsMenu from './ui_state/components/agents_menu.js';
import MainButtons from './ui_state/components/main_buttons.js';
import ParkourConfig from './ui_state/components/parkour_config.js';
import DrawingMode from "./ui_state/components/drawing_mode.js";
import AdvancedOptions from "./ui_state/components/advanced_options.js";
import EnvsSet from "./ui_state/components/envs_set.js";
import GlobalElements from "./ui_state/components/global_elements.js";
import RadarChart from "./radarChart.js";

// Sync videos
let maze_videos = document.getElementsByClassName("accel-maze-video");
maze_videos[0].addEventListener('seeked', function() {
  for(let j=1; j < maze_videos.length; j++) {
    maze_videos[j].currentTime = 0;
  }
}, false);

// Force videos to play
let videoList = document.getElementsByTagName("video");
for (let i=0; i<videoList.length; i++) {
  videoList[i].play();
}

/**
 * Opens the given modal.
 * @param modal {HTMLDivElement}
 */
window.openModal = (modal) => {
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = "block";
    modal.classList.add('show');
}

/**
 * Closes the given modal and clears the text fields.
 * @param modal {HTMLDivElement}
 */
window.closeModal = (modal) => {
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.querySelectorAll('.text-field').forEach((span, index) => {
       span.value = "";
    });
}

// Save env modal setup
// const saveEnvModal = document.querySelector('#saveEnvModal');
// saveEnvModal.querySelectorAll('.btn').forEach((span, index) => {
//     span.addEventListener('click', () => {

//         // If the confirm button is clicked
//         if(span.getAttribute('id') == "save-confirm-btn"){

//             // Gets the name and description values
//             let name = saveEnvModal.querySelector('#env-name').value;
//             if(name == ""){
//                 name = "Custom Environment " + store.state.envsSets.customEnvsSet.length;
//             }
//             let description = saveEnvModal.querySelector('#env-description').value;

//             // Saves the current position of the agents
//             for(let i = 0; i < store.state.agents.length; i++){
//                 store.dispatch('setAgentInitPos', {index: i, init_pos: window.game.env.agents[i].agent_body.reference_head_object.GetPosition().Clone()});
//             }

//             // Adjusts the zoom and scroll to capture the thumbnail
//             let previous_zoom = window.game.env.zoom;
//             let previous_scroll = [...window.game.env.scroll];
//             window.game.env.set_zoom(THUMBNAIL_ZOOM);
//             window.game.env.set_scroll(null, THUMBNAIL_SCROLL_X, 0);
//             window.game.env.render();

//             // Creates the state of the current env
//             let env = {
//                 terrain: {
//                     ground: [...window.ground],
//                     ceiling: [...window.ceiling],
//                     parkourConfig: Object.assign({}, store.state.parkourConfig.terrain),
//                     creepersConfig: Object.assign({}, store.state.parkourConfig.creepers)
//                 },
//                 agents: [...store.state.agents],
//                 description: {
//                     name: name,
//                     text: description
//                 },
//                 // Captures the canvas to create the thumbnail of the env
//                 image: window.canvas.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream")
//             };

//             // Adds the env to the custom set
//             store.dispatch('addEnv',{set: 'custom', env: env});

//             // Sets back the zoom and scroll to the previous values
//             window.game.env.set_zoom(previous_zoom);
//             window.game.env.set_scroll(null, previous_scroll[0], previous_scroll[1]);
//             window.game.env.render();
//         }

//         closeModal(saveEnvModal);
//     });
// });

// Main buttons setup
const runButton = document.querySelector("#runButton");
runButton.addEventListener('click', () => {
    store.dispatch('toggleRun', {});

    let checkRunStatus = true;
    window.runStatusChecker = setInterval(() => {
        if(window.game.running){
            let all_x = window.game.env.agents.map((agent) => {
                return agent.agent_body.reference_head_object.m_xf.p.x;
            });
            let max_x = Math.max.apply(Math, all_x);
            if(max_x >= 90) {
                store.dispatch('resetSimulation', {});
            }
        }
    }, 2000); 
});
const resetButton = document.querySelector("#resetButton");
resetButton.addEventListener('click', () => {
    store.dispatch('resetSimulation', {});
});
// const saveEnvButton = document.querySelector('#saveEnvButton');
// saveEnvButton.addEventListener('click', () => {
//     openModal(saveEnvModal);
// });
const mainButtonsInstance = new MainButtons();
mainButtonsInstance.render();

// Morphologies list setup
// const morphologiesListInstance = new MorphologiesList();
// morphologiesListInstance.render();

// Agents list setup
// const agentListInstance = new AgentsList();
// agentListInstance.render();

// Agent selector setup
const agentsMenuInstance = new AgentsMenu();
agentsMenuInstance.render();


const DEFAULT_CONFIG = {
    ground_roughness: [1,1],
    pit_gap: [3,5],
    stump_width: [1,3],
    stump_height: [1,3],
    stair_height: [1,1],
    stair_width: [4,5],
    stair_steps: [3,5]
}

const ENV_CONFIG_MAX_VALUES = {
  ground_roughness: 15,
  stump_height: 4,
  pit_gap: 5,
  stair_steps: 10
}

function envConfig2RadarData(envConfig=null) {
  let config = DEFAULT_CONFIG;

  if(envConfig != null) {
    for (var k in envConfig) {
        config[k] = envConfig[k];
    }
  }

  let data = [{
    axes: [
      {axis:"Roughness min",value:config.ground_roughness[0],maxValue:ENV_CONFIG_MAX_VALUES.ground_roughness},
      {axis:"Roughness max",value:config.ground_roughness[1],maxValue:ENV_CONFIG_MAX_VALUES.ground_roughness},
      {axis:"Stump min",value:config.stump_height[0],maxValue:ENV_CONFIG_MAX_VALUES.stump_height},
      {axis:"Stump max",value:config.stump_height[1],maxValue:ENV_CONFIG_MAX_VALUES.stump_height},
      {axis:"Pit gap min",value:config.pit_gap[0],maxValue:ENV_CONFIG_MAX_VALUES.pit_gap},
      {axis:"Pit gap max",value:config.pit_gap[1],maxValue:ENV_CONFIG_MAX_VALUES.pit_gap},
      {axis:"Steps min",value:config.stair_steps[0],maxValue:ENV_CONFIG_MAX_VALUES.stair_steps},
      {axis:"Steps max",value:config.stair_steps[1],maxValue:ENV_CONFIG_MAX_VALUES.stair_steps} 
    ]
  }];

  return data;
}

var data = envConfig2RadarData();

var chart = RadarChart.chart();
var cfg = chart.config(); // retrieve default config
cfg.w = 180;
cfg.h = 180;
cfg.color = (i) => "#0D6EFD";
var svg = d3.select('#radar-chart').append('svg')
  .attr('width', cfg.w + 60)
  .attr('height', cfg.h + 10);

chart.config({w: 180, h:180, axisText: true, axisLine: true, levels: 3, circles: false, maxValue:1});
cfg = chart.config();
function updateRadarChart(data) {
  var game = svg.selectAll('g.game').data(
    [
      // randomDataset(),
      data,
    ]
  );
  game.enter().append('g').classed('game', 1);
  game
    .attr('transform', function(d, i) { return 'translate(30,5)'; })
    .call(chart);
}
updateRadarChart(data)


function updateEnvConfig(config) {
    if (!window.hasOwnProperty('envConfig')) {
        window.envConfig = {}
    }

    for (var k in config) {
        window.envConfig[k] = config[k];
    }

    updateRadarChart(
      envConfig2RadarData(config)
    )

    store.dispatch('resetSimulation', {});
}

function handleEnvConfigRangeUpdate(key, e) {
    let valueLabel = document.getElementById(key.replace('_', '-') + "-value");
    let slider = document.getElementById(key.replace('_', '-') + "-slider");
    let value = slider.value;

    // Trigger global env config update
    let partialConfig = {};
    let range = value.split(',').map(function(x) {
        return parseInt(x, 10);
    });
    partialConfig[key] = range;
    updateEnvConfig(partialConfig);

    if (range[0] == range[1]) {
        valueLabel.innerHTML = range[0];
    }
    else {
        valueLabel.innerHTML = range[0] + ' - ' + range[1];
    }
}

// Env slide controls setup
const roughnessSlider = document.querySelector("#ground-roughness-slider");
roughnessSlider.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"ground_roughness"))
roughnessSlider.nextElementSibling.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"ground_roughness"));

const stumpHeightSlider = document.querySelector("#stump-height-slider");
stumpHeightSlider.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"stump_height"))
stumpHeightSlider.nextElementSibling.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"stump_height"));

const pitGapSlider = document.querySelector("#pit-gap-slider");
pitGapSlider.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"pit_gap"))
pitGapSlider.nextElementSibling.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"pit_gap"));

const stairStepsSlider = document.querySelector("#stair-steps-slider");
stairStepsSlider.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"stair_steps"))
stairStepsSlider.nextElementSibling.addEventListener('input', handleEnvConfigRangeUpdate.bind(null,"stair_steps"));

/*
 * Fetches the available morphologies and policies from the JSON file
 */
fetch('./dist/policies.json')
    .then(resp => resp.text().then(body => {
        window.agent_policies = JSON.parse(body);
        return window.agent_policies;
    }))
    .then(types => {
        types.forEach(type => {
            type["morphologies"].forEach(morphology => {
                // Adds the morphology with its compatible policies to the list of morphologies +
                // Add the agent to the list
                store.dispatch('addMorphology', {
                    morphology: morphology["morphology"],
                    seeds: morphology["seeds"].map((seed, index) => {
                        seed["idx"] = index;
                        return seed;
                    })
                });
            });
        });
    });

/*
 * Fetches the base environments from the JSON file.
 * The JSON file must contain a list of the names of all the files contained in the 'base_envs_set' folder.
 */
fetch('./dist/base_envs_set.json')
    .then(resp => resp.text().then(body => {
        return JSON.parse(body);
    }))
    .then(data => data['filenames'].forEach(filename => {

        // Fetches each JSON env file and parses them to get the corresponding environment
        fetch('./dist/base_envs_set/' + filename)
            .then(resp => resp.text().then(body => {
                let env = JSON.parse(body);

                // Adds the environment contained in the JSON file to the base set
                store.dispatch('addEnv',{set: 'base', env: env});
            }))
    }));

/* Utility functions that require access to 'store' */

/**
 * Wrapper for init_game() with default parameters.
 */
window.init_default = () => {
    store.dispatch('init_default', {});
}

/**
 * Indicates whether the drawing is active.
 * @returns {boolean}
 */
window.is_drawing = () => {
    return store.state.drawingModeState.drawing;
}

/**
 * Indicates whether the drawing_ground is active.
 * @returns {boolean}
 */
window.is_drawing_ground = () => {
    return store.state.drawingModeState.drawing_ground;
}

/**
 * Indicates whether the drawing_ceiling is active.
 * @returns {boolean}
 */
window.is_drawing_ceiling = () => {
    return store.state.drawingModeState.drawing_ceiling;
}

/**
 * Indicates whether the erasing is active.
 * @returns {boolean}
 */
window.is_erasing = () => {
    return store.state.drawingModeState.erasing;
}

/**
 * Indicates whether the drawing_circle is active.
 * @returns {boolean}
 */
window.is_drawing_circle = () => {
    return store.state.advancedOptionsState.assets.circle;
}

/**
 * Generates the terrain from the drawing (true) or vice-versa (false).
 * @param payload {boolean}
 */
window.generateTerrain = (payload) => {
    store.dispatch('generateTerrain', payload);
}

/**
 * Re-draws the drawing canvas.
 */
window.refresh_drawing = () => {
    store.dispatch('refreshDrawing', {});
}

/**
 * Loads the default environment (Flat Parkour).
 */
window.loadDefaultEnv = () => {
    let defaultEnv = store.state.envsSets.baseEnvsSet.find(env => env.description["EN"].name.split(" ")[0] == "Flat");
    store.dispatch('loadEnv', defaultEnv != null ? defaultEnv : store.state.envsSets.baseEnvsSet[0]);

    // Load all agents

}

/**
 * Handles mouse clicks outside the canvas.
 */
window.deselectDrawingButtons = () => {
    store.dispatch('deselectDrawingButtons', {});
}

/**
 * Handles agent selection according to the given index.
 * @param index {number} - Index of the agent to select in the list of agents
 */
window.set_agent_selected = (index) => {
    store.dispatch('selectAgent', {index: index});
}

/**
 * Handles agent following according to the given index.
 * @param index {number} - Index of the agent to select in the list of agents
 */
window.set_agent_followed = (index) => {
    store.dispatch('followAgent', {index: index});
}

/**
 * Handles agent deletion.
 * @param agent {Object} - Agent to delete
 */
window.delete_agent = (agent) => {
    store.dispatch('deleteAgent', {index: window.game.env.agents.indexOf(agent)});
}

/**
 * Returns the current language.
 * @return {string}
 */
window.get_language = () => {
    return store.state.language;
}

