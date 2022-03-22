import store from './ui_state/store/index.js';
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
    // Get max x of all agents
    // if (window.game.steps > 250) {
    //     let returns = window.game.returns()
    //     let return_rate = Math.max(...returns)/window.game.steps;
    //     if (return_rate <= 0.2) { // Log adversarial level
    //         let level_description = window.game.env.full_level_description();
    //         mixpanel.track
    //     }
    // }

    store.dispatch('resetSimulation', {});
    // Check if furthest agent is greater than init position. If so, track mixpanel
});

const mainButtonsInstance = new MainButtons();
mainButtonsInstance.render();

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


document.querySelector("input[name=auxAgentsSwitch]").addEventListener('input', (event) => {
        let target = event.target;
        store.dispatch('showAuxAgents', {show: target.checked});
        target.checked = store.state.simulationState.showAuxAgents;
    });

function addPreloadLinkToResource(path) {
    const link = document.createElement('link');
    link.href = path;
    link.rel = 'prefetch';

    document.getElementsByTagName('head')[0].appendChild(link);
}

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

                        const path2model_bin = "dist/" + seed.path + "/group1-shard1of1.bin";
                        const path2model_json = "dist/" + seed.path + "/model.json";

                        addPreloadLinkToResource(path2model_bin);
                        addPreloadLinkToResource(path2model_json);

                        return seed;
                    })
                });

                // Preload model files
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
window.set_agent_name_followed = (name) => {
    store.dispatch('followAgent', {name: name});
}

/**
 * Handles agent deletion.
 * @param agent {Object} - Agent to delete
 */
// window.delete_agent = (agent) => {
//     store.dispatch('deleteAgent', {index: window.game.env.agents.indexOf(agent)});
// }

/**
 * Returns the current language.
 * @return {string}
 */
window.get_language = () => {
    return store.state.language;
}

