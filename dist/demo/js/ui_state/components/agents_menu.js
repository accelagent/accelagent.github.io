import Component from '../lib/component.js';
import store from '../store/index.js';

const thumbnails_path = "dist/img/";

const RENDERED_AGENT_NAMES = {
    accel: "ACCEL",
    plr: "PLR",
    dr: "Domain Randomization",
    alpgmm: "ALP-GMM"
}

/**
 * @classdesc UI component for the list of running agents.
 */
export default class AgentsMenu extends Component {
    constructor() {
        super({
            store,
            element: document.querySelector('#agents-menu-container'),
            eventName: 'agentsMenuChange'
        });
    }

    _agent_at_menu_index_visible(index) {
        let name = Object.entries(store.state.name2agents)[index][0];
        let state = store.state;
        for (let i=0; i < state.agents.length; i++) {
            if (state.agents[i].name == name && state.agents[i].visible) {
                console.log(state.agents);
                return true;
            }
        }
        return false;
    }

    /**
     * Renders the list of running agents and adds event listeners to the different elements.
     */
    render() {
        let dict = window.lang_dict[store.state.language]['agentsList'];
        let morph_dict = window.lang_dict[store.state.language]['morphologies'];
        this.element.querySelector('#agents-menu').innerHTML = store.state.agents.map(agent => {
            if (agent.seed == 0) {
                // Creates a list item for each agent
                return `<li class="agents-menu-item" name="agents-menu-item">

                        <div class="agent-description">
                            <img src=${thumbnails_path + agent.name + "_avatar.png"}
                                     class="agent-avatar">
                            <div class="agent-label">${RENDERED_AGENT_NAMES[agent.name]}</div>
                        </div>

                        <!-- Select agent checkbox -->
                        <div class="agent-render-controls">
                            <div class="checkbox-container">
                                <label class="form-check-label" for="agentSwitch">Show</label>         
                                <div class="form-check form-switch mx-1">
                                    <input name="renderSwitch" class="form-check-input" type="checkbox"">
                                </div>
                            </div>
                            
                            <!-- Follow switch -->   
                            <div class="checkbox-container">      
                                <label class="form-check-label" for="followSwitch">Follow</label>         
                                <div class="form-check form-switch mx-1">
                                    <input name="followSwitch" class="form-check-input" type="checkbox"">
                                </div>
                            </div>
                        </div>
                    </li>`;
            }
            else {
                return '';
            }
        }).join('');

        // Renders the list items differently when drawing or if the agent is selected
        this.element.querySelectorAll('li[name="agents-menu-item"]').forEach((span, index) => {
            if(store.state.drawingModeState.drawing){
                span.classList.add('disabled');
            }
            else{
                if(store.state.agents[index] == store.state.simulationState.agentSelected){
                    span.classList.add("active");
                }
                else{
                    span.classList.remove("active");
                }
            }
        });

        /* EVENT LISTENERS */
        // Resets the agent's initial position
        this.element.querySelectorAll('button[name="resetPositionButton"]').forEach((span, index) => {
            span.addEventListener('click', () => {
                store.dispatch('setAgentInitPos', {index: index, init_pos: null});
                let init_x = TERRAIN_STEP * INITIAL_TERRAIN_STARTPAD / 2;
                window.game.env.set_agent_position(window.game.env.agents[index], init_x, null);
                window.game.env.render();
            });
        });

        // Follows the agent
        this.element.querySelectorAll('input[name="followSwitch"]').forEach((span, index) => {
            span.addEventListener('input', () => {
                store.dispatch('followAgent', {index: span.checked ? index : -1});
            });
            span.checked = store.state.simulationState.agentFollowed == store.state.agents[index];
        });

        // Renders the agent
        this.element.querySelectorAll('input[name="renderSwitch"]').forEach((span, index) => {
            span.addEventListener('input', () => {
                if(span.checked) {
                    store.dispatch('addAgent', {index: index});
                }
                else {
                    store.dispatch('deleteAgent', {index: index, keep: true});
                }   
            });
            span.checked = index < store.state.agents.length ? this._agent_at_menu_index_visible(index) : false;
        });

        // Renames the agent
        // this.element.querySelectorAll('input[name="agentNameArea"]').forEach((span, index) => {
        //     span.addEventListener('keydown', (event) => {
        //         if(event.keyCode == '13'){
        //             store.dispatch('renameAgent', {index: index, value: span.value});
        //         }
        //     });
        // });

        // /* Initializes tooltips */
        // this.element.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el, index) => {
        //     return new bootstrap.Tooltip(el, {
        //         trigger: 'hover'
        //     });
        // });
    }
};