// All available UI state mutations

const AGENT_ORDERING = {
    accel:0,
    plr:1,
    alpgmm:2,
    dr:3
}

function sortAgents(a,b) {
    if (!AGENT_ORDERING.hasOwnProperty(a.name) || !AGENT_ORDERING.hasOwnProperty(b.name)) {
        return a.name.localeCompare(b.name);
    }
    else if (a.name == b.name) {
        return 0;
    }
    else {
        return AGENT_ORDERING[a.name] > AGENT_ORDERING[b.name] ? 1 : -1;
    }
}

export default {

    /**
     * Adds the given environment to the specified set.
     * @param state {Object} - UI state
     * @param payload {{set: string, env: Object}}
     * @return {Object} - UI state
     */
    addEnv(state, payload){
        if(payload.set == 'base'){
            state.envsSets.baseEnvsSet.push(payload.env);
        }
        else if(payload.set == 'custom'){
            state.envsSets.customEnvsSet.push(payload.env);
        }

        // Sorts the set in the lexicographic order according to the name of the envs
        state.envsSets.baseEnvsSet.sort(function(a, b){

            // Exception for env whose name begins with "Flat": always first
            if(a.description["EN"].name.split(" ")[0] == "Flat"){
                return -1;
            }
            else if(b.description["EN"].name.split(" ")[0] == "Flat"){
                return 1;
            }
            else{
                return a.description["EN"].name.localeCompare(b.description["EN"].name);
            }
        });
        return state;
    },

    /**
     * Removes the environment of the given index from the custom set.
     * @param state {Object} - UI state
     * @param payload {number} - Index of the environment to remove
     * @return {Object} - UI state
     */
    deleteEnv(state, payload){
        state.envsSets.customEnvsSet.splice(payload, 1);
        return state;
    },

    /**
     * Updates the given terrain parameter.
     * @param state {Object} - UI state
     * @param payload {{name: string, value: number}} - Name and value of the terrain parameter to change
     * @return {Object} - UI state
     */
    updateParkourConfig(state, payload){
        switch (payload.name) {
            case 'dim1':
                state.parkourConfig.terrain.dim1 = payload.value;
                break;
            case 'dim2':
                state.parkourConfig.terrain.dim2 = payload.value;
                break;
            case 'dim3':
                state.parkourConfig.terrain.dim3 = payload.value;
                break;
            case 'smoothing':
                state.parkourConfig.terrain.smoothing = payload.value;
                break;
            case 'waterLevel':
                state.parkourConfig.terrain.waterLevel = payload.value;
                break;
            case 'width':
                state.parkourConfig.creepers.width = payload.value;
                break;
            case 'height':
                state.parkourConfig.creepers.height = payload.value;
                break;
            case 'spacing':
                state.parkourConfig.creepers.spacing = payload.value;
                break;
            case 'type':
                state.parkourConfig.creepers.type = payload.value;
                break;
        }
        return state;
    },

    /**
     * Initializes the game with default parameters.
     * @param state {Object} - UI state
     * @param payload {}
     * @return {Object} - UI state
     */
    init_default(state, payload){
        state.simulationState.status = 'init';
        state.simulationState.showAuxAgents = false;

        if(window.game != null){
            window.align_terrain = {
                align: false, // no alignment
                ceiling_offset: window.ceiling.length > 0 ? window.game.env.ceiling_offset - window.ceiling[0].y : null,
                ground_offset: window.ground.length > 0 ? window.ground[0].y : null, // first ground y value
                smoothing: window.game.env.TERRAIN_CPPN_SCALE // current smoothing
            };
        }

        let terrainConfig = state.parkourConfig.terrain;
        let creepersConfig = state.parkourConfig.creepers;
        init_game(
            [terrainConfig.dim1, terrainConfig.dim2, terrainConfig.dim3],
            terrainConfig.waterLevel,
            creepersConfig.width,
            creepersConfig.height,
            creepersConfig.spacing,
            terrainConfig.smoothing,
            creepersConfig.type == 'Swingable',
            window.ground,
            window.ceiling,
            window.align_terrain
        );

        this.reloadAgents(state);
    },

    /**
     * Runs the simulation.
     * @param state {Object} - UI state
     * @param payload {}
     * @return {Object} - UI state
     */
    startSimulation(state, payload) {
        state.simulationState.status = 'running';
        window.game.run();
        return state;
    },

    /**
     * Pauses the simulation.
     * @param state {Object} - UI state
     * @param payload {}
     * @return {Object} - UI state
     */
    pauseSimulation(state, payload) {
        window.game.pause();
        state.simulationState.status = 'paused';
        return state;
    },

    /**
     * Resets the simulation.
     * @param state {Object} - UI state
     * @param payload {{keepPositions: boolean}}
     * @return {Object} - UI state
     */
    resetSimulation(state, payload) {
        state.simulationState.status = 'init';

        // Gets the morphology, policy and position of the current running agents
        let activeAgents = state.agents;
        if (!state.simulationState.showAuxAgents) {
            activeAgents = [];
            for (let [name, agents] of Object.entries(state.name2agents)) {
                activeAgents.push(agents[0]);
            }
        }

        const agents = {
            morphologies: activeAgents.map(a => a.morphology),
            policies: activeAgents.map(a => {
                return {
                    name: a.name,
                    seed: a.seed,
                    path: a.path
                };
            }),
            positions: [],
            visible: activeAgents.map(a => a.visible),
        }

        // Gets the current position of each agent
        if (payload.keepPositions) {
            agents.positions = [...activeAgents.map((agent, index) => window.game.env.agents[index].agent_body.reference_head_object.GetPosition())];
        }
        // Gets the initial position of each agent
        else {
            let agent_name2index = this.agentName2VisibleIndex(state)[0];
            agents.positions = [...activeAgents.map((agent, index) => {
                let visible_index = agent_name2index[agent.name];
                if(agent.visible && visible_index.includes(index)) {
                    window.game.env.agents[index].init_pos;
                }
            })];
        }

        const terrainConfig = state.parkourConfig.terrain;
        const creepersConfig = state.parkourConfig.creepers;

        // Updates the terrain alignment
        window.align_terrain = {
            align: true, // aligns the terrain with the startpad
            ceiling_offset: window.align_terrain.ceiling_offset, // keeps the same
            ground_offset: window.align_terrain.ground_offset, // keeps the same
            smoothing: window.game.env.TERRAIN_CPPN_SCALE // smoothing of the current terrain
        };

        // Reinitializes the environment
        window.game.reset(
            agents,
            [terrainConfig.dim1,terrainConfig.dim2,terrainConfig.dim3],
            terrainConfig.waterLevel,
            creepersConfig.width,
            creepersConfig.height,
            creepersConfig.spacing,
            terrainConfig.smoothing,
            creepersConfig.type == "Swingable",
            window.ground,
            window.ceiling,
            window.align_terrain);


        if(window.game.env.agents.length > 0) {
            this.followAgent(state, {index:0});
        }

        return state;
    },


    sortAgents(state) {
        // sort the agents in state
        return state;
    },

    agentExists(agent) {
        if(agent == null) {
            return false;
        }

        for(let i=0; i < window.game.env.agents.length; i++) {
            let game_agent = window.game.env.agents[i]
            if(game_agent.name == agent.name && game_agent.seed == agent.seed) {
                return true
            }
        }
        return false;
    },

    agentName2VisibleIndex(state) {
        // Returns the index of visible agents by name in the game environment

        let name2index_window = {}
        let name2index = {}

        let name_agent_list = Object.entries(state.name2agents);
        for (i=0;i<name_agent_list.length;i++) {
            let name = name_agent_list[i][0];
            name2index_window[name] = [];
            name2index[name] = [];
        }

        for(let i=0; i < window.game.env.agents.length;i++) {
            let agent = window.game.env.agents[i];
            name2index_window[agent.name].push(i);
        }

        for(let i=0; i < state.agents.length; i++) {
            let agent = state.agents[i];
            name2index[agent.name] = agent.name in name2index_window ? name2index_window[agent.name] : null;
        }

        return [name2index, name2index_window];
    },

    showAuxAgents(state) {
        let showAuxAgents = state.simulationState.showAuxAgents;
        state.simulationState.showAuxAgents = !showAuxAgents;

        let num_agent_names = Object.entries(state.name2agents).length;

        for (let i=0; i < num_agent_names; i++) {
            if (state.simulationState.showAuxAgents) { // Add agents
                state = this.addAgent(state, {'index': i, 'aux_only': true});
            }
            else { // Remove agents
                state = this.deleteAgent(state, {'index': i, 'keep': true, 'aux_only': true});
            }
        }

        // Reset the simulation
        state = this.resetSimulation(state, {'keepPositions':false});

        return state;
    },

    /**
     * Adds the given agent to the environment and renders it.
     * @param state {Object} - UI state
     * @param payload {{morphology: string, name: string, age: string, path: string, init_pos: {x: number, y: number}}}
     * @return {Object} - UI state
     */
    addAgent(state, payload) {
        let morphology = 'bipedal';
        let agent = null;
        let name_agent_lists = Object.entries(state.name2agents);
        let num_agent_names = name_agent_lists.length;
        let init_pos = {"x":4.664080407626852,"y":5.7120234541018675};
        if(!payload.hasOwnProperty('index') || payload.index == null) {
            state.agents.push(payload);
            agent = {name: payload.name, seed: payload.seed, path: payload.path, visible: true};
            morphology = payload.morphology;
            init_pos = payload.init_pos;
        }
        else if (payload.index < num_agent_names) {
            let agents = name_agent_lists[payload.index][1]

            agents[0].visible = true;
            morphology = agents[0].morphology;

            if (!payload.aux_only) {
                this.addAgentToGame(agents[0], morphology, init_pos);
            }

            if (state.simulationState.showAuxAgents) { // Add agents for additional seeds
                for (let i=1; i<agents.length; i++) {
                    agents[i].visible = true;
                    this.addAgentToGame(agents[i], morphology, init_pos);
                }   
            }
        }

        // state = this.sortAgents(state);

        window.game.env.render();

        return state;
    },

    addAgentToGame(agent, morphology, init_pos) {
        if(window.game != null){
            if(!this.agentExists(agent)) {
                window.game.env.add_agent(morphology, agent, init_pos);
            }
        }
    },

    /**
     * Removes the agent of the given index from environment and renders it.
     * @param state {Object} - UI state
     * @param payload {{index: number}}
     * @return {Object} - UI state
     */
    deleteAgent(state, payload) {
        let agent_name = Object.entries(state.name2agents)[payload.index][0]
        let agent_all_index = this.agentName2VisibleIndex(state);
        let agent_visible_index = agent_all_index[0][agent_name]
        let agent_index = agent_all_index[1][agent_name]

        if (payload.aux_only) { // Remove main agent index
            if (agent_visible_index) {
                agent_visible_index.splice(agent_visible_index.indexOf(0), 1);
            }
            agent_index.splice(agent_index.indexOf(0), 1);
        }

        if(payload.hasOwnProperty('keep')) {
            // Sets all agents with the matching name as agent at index to true
            for (let i=0; i < agent_index.length; i++) {
                state.agents[agent_index[i]].visible = false;
            }
        }
        else {
            let updated_agents = [];
            for (let i=0; i < state.agents.length; i++) {
                if (!agent_index.includes(i)) {
                    updated_agents.push(state.agents[agent_index[i]])
                }
            }
            state.agents = updated_agents;
        }

        state = this.sortAgents(state);

        if(window.game != null){
            // @TODO: Need to remove all agents matching this set, using filter
            for (let i=0; i < agent_visible_index.length; i++) {
                window.game.env.delete_agent(i);
            }
            
            window.game.env.render();
        }

        return state;
    },

    /**
     * Sets the initial position of the agent of the given index.
     * @param state {Object} - UI state
     * @param payload {{index: number, init_pos: {x: number, y: number}}}
     * @return {Object} - UI state
     */
    setAgentInitPos(state, payload){
        window.game.env.agents[payload.index].init_pos = payload.init_pos;
        state.agents[payload.index].init_pos = payload.init_pos;
        return state;
    },

    /**
     * Selects the agent of the given index.
     * @param state {Object} - UI state
     * @param payload {{index: number}}
     * @return {Object} - UI state
     */
    selectAgent(state, payload) {
        if(payload.index != -1){
            window.agent_selected = window.game.env.agents[payload.index];
            state.simulationState.agentSelected = state.agents[payload.index];
        }
        // Sets the selected agent to null if index == -1
        else{
            window.agent_selected = null;
            state.simulationState.agentSelected = null;
        }
        return state;
    },

    /**
     * Follows the agent of the given index and renders the environment.
     * @param state {Object} - UI state
     * @param payload {{index: number}}
     * @return {Object} - UI state
     */
    followAgent(state, payload) {
        if(payload.index != -1){
            window.agent_followed = window.game.env.agents[payload.index];
            state.simulationState.agentFollowed = state.agents[payload.index];
        }
        // Sets the followed agent to null if index == -1
        else {
            window.agent_followed = null;
            state.simulationState.agentFollowed = null;
        }
        window.game.env.render();
        return state;
    },

    /**
     * Renames the agent of the given index with the given string value.
     * @param state {Object} - UI state
     * @param payload {{index: number, value: string}}
     * @return {Object} - UI state
     */
    renameAgent(state, payload) {
        state.agents[payload.index].name = payload.value;
        window.game.env.agents[payload.index].name = payload.value;
        window.game.env.render();
        return state;
    },

    /**
     * Selects the seed option of the given index for the given morphology.
     * @param state {Object} - UI state
     * @param payload {{morphology: string, index: number}}
     * @return {Object} - UI state
     */
    selectSeedIdx(state, payload) {
        state.currentSeedsIdx[payload.morphology] = payload.index;
        return state;
    },

    /**
     * Adds the given morphology with the given policy seeds to the list of morphologies.
     * @param state {Object} - UI state
     * @param payload {{morphology: string, seeds: []}}
     * @return {Object} - UI state
     */
    addMorphology(state, payload) {
        state.morphologies.push(payload);

        // Add the agent for each morphology
        let morph = payload;        

        for (let i=0; i < morph.seeds.length; i++) {
            let info = morph.seeds[i].name.split('/');
            let name = info[0];
            let seed = info[1].split('_s')[1];

            let agent = {
                morphology: morph.morphology,
                name: name,
                seed: parseInt(seed),
                path: morph.seeds[i].path,
                init_pos: null,
                visible: true
            }
            state.agents.push(agent);

            if (state.name2agents.hasOwnProperty(name)) {
                state.name2agents[name].push(agent);
            }
            else {
                state.name2agents[name] = [agent,];
            }
        }

        this.reloadAgents(state, {});

        return state;
    },

    reloadAgents(state, payload={}) {
        if(window.game == null) {
            return state;
        }
        
        state.agents.sort(sortAgents);

        window.game.env.delete_all_agents();

        for (let [name, agents] of Object.entries(state.name2agents)) {
            let num_agents = state.simulationState.showAuxAgents ? agents.length : 1;
            for (i=0; i < num_agents; i++) {
                let agent = agents[i];
                if(window.game != null && agent.visible){
                    window.game.env.add_agent(agent.morphology, agent);
                }
            }
        }

        if(window.game.env.agents.length > 0) {
            this.followAgent(state, {index:0});
        }

        window.game.env.render();

        return state;
    },

    /**
     * Changes the active tab.
     * @param state {Object} - UI state
     * @param payload {string} - Name of the active tab
     * @return {Object} - UI state
     */
    switchTab(state, payload) {
        state.activeTab = payload;
        return state;
    },

    /**
     * Activates or deactivates the ground drawing mode.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    drawGround(state, payload){
        state.drawingModeState.drawing_ground = payload;
        state.drawingModeState.drawing_ceiling = false;
        state.drawingModeState.erasing = false;
        state.advancedOptionsState.assets.circle = false;
        return state;
    },

    /**
     * Activates or deactivates the ceiling drawing mode.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    drawCeiling(state, payload){
        state.drawingModeState.drawing_ground = false;
        state.drawingModeState.drawing_ceiling = payload;
        state.drawingModeState.erasing = false;
        state.advancedOptionsState.assets.circle = false;
        return state;
    },

    /**
     * Activates or deactivates the erasing mode.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    erase(state, payload){
        state.drawingModeState.drawing_ground = false;
        state.drawingModeState.drawing_ceiling = false;
        state.drawingModeState.erasing = payload;
        state.advancedOptionsState.assets.circle = false;
        return state;
    },

    /**
     *
     * @param state {Object} - UI state
     * @param payload
     * @return {Object} - UI state
     */
    drawCircle(state, payload){
        state.drawingModeState.drawing_ground = false;
        state.drawingModeState.drawing_ceiling = false;
        state.drawingModeState.erasing = false;
        state.advancedOptionsState.assets.circle = payload;
        return state;
    },

    /**
     * Deactivates all drawing and erasing modes.
     * @param state {Object} - UI state
     * @param payload {}
     * @return {Object} - UI state
     */
    deselectDrawingButtons(state, payload){
        state.drawingModeState.drawing_ground = false;
        state.drawingModeState.drawing_ceiling = false;
        state.drawingModeState.erasing = false;
        state.advancedOptionsState.assets.circle = false;
        return state;
    },

    /**
     * Clears the drawing canvas and resets the drawing mode variables.
     * @param state {Object} - UI state
     * @param payload
     * @return {Object} - UI state
     */
    clear(state, payload){

        drawing_canvas.clear();
        window.ground = [];
        window.ceiling = [];
        window.terrain = {
            ground: [],
            ceiling: []
        };
        return state;
    },

    /**
     * Generates the terrain from the drawing (true) or vice-versa (false).
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    generateTerrain(state, payload){

        state.drawingModeState.drawing = !payload;
        state.simulationState.status = 'init';

        // Generates the terrain from the shapes drawn
        if(payload) {

            // Horizontally sorts the ground points that have been drawn
            window.terrain.ground.sort(function (a, b) {
                return a.x - b.x;
            });
            window.ground = [...window.terrain.ground];

            // Horizontally sorts the ceiling points that have been drawn
            window.terrain.ceiling.sort(function (a, b) {
                return a.x - b.x;
            });
            window.ceiling = [...window.terrain.ceiling];

            // Updates terrain alignment
            window.align_terrain = {
                align: false, // no alignment
                ceiling_offset: window.ceiling.length > 0 ? window.game.env.ceiling_offset - window.ceiling[0].y : null,
                ground_offset: window.ground.length > 0 ? window.ground[0].y : null, // first ground y value
                smoothing: window.game.env.TERRAIN_CPPN_SCALE // current smoothing
            };

            let terrainConfig = state.parkourConfig.terrain;
            let creepersConfig = state.parkourConfig.creepers;
            init_game(
                [terrainConfig.dim1, terrainConfig.dim2, terrainConfig.dim3],
                terrainConfig.waterLevel,
                creepersConfig.width,
                creepersConfig.height,
                creepersConfig.spacing,
                terrainConfig.smoothing,
                creepersConfig.type == 'Swingable',
                window.ground,
                window.ceiling,
                window.align_terrain,
                window.game.env.zoom,
                window.game.env.scroll
            );
        }

        // Generates the drawing from the terrain
        else {

            // Draws the forbidden red area on the forbidden canvas
            window.draw_forbidden_area();

            // Clears the previous drawing
            drawing_canvas.clear();
            window.terrain = {
                ground: [],
                ceiling: []
            };

            // Draws the shape of the current ground
            if(window.ground.length > 0){

                for(let i = 0; i < window.ground.length - 1; i++){
                    let p = window.ground[i];
                    let p2 = window.ground[i + 1];
                    let p_pos = convertPosEnvToCanvas(p.x, p.y);
                    let p2_pos = convertPosEnvToCanvas(p2.x, p2.y);

                    drawing_canvas.stroke("#66994D");
                    drawing_canvas.strokeWeight(4);
                    drawing_canvas.line(
                        p_pos.x,
                        p_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1],
                        p2_pos.x,
                        p2_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1]
                    )

                    window.terrain.ground.push({x: p.x, y: p.y});
                }
                let p = window.ground[window.ground.length - 1];
                window.terrain.ground.push({x: p.x, y: p.y});
            }

            // Draws the shape of the current ceiling
            if(window.ceiling.length > 0){

                for(let i = 0; i < window.ceiling.length - 1; i++){
                    let p = window.ceiling[i];
                    let p2 = window.ceiling[i + 1];
                    let p_pos = convertPosEnvToCanvas(p.x, p.y);
                    let p2_pos = convertPosEnvToCanvas(p2.x, p2.y);

                    drawing_canvas.stroke("#808080");
                    drawing_canvas.strokeWeight(4);
                    drawing_canvas.line(
                        p_pos.x,
                        p_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1],
                        p2_pos.x,
                        p2_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1]
                    )

                    window.terrain.ceiling.push({x: p.x, y: p.y});
                }
                let p = window.ceiling[window.ceiling.length - 1];
                window.terrain.ceiling.push({x: p.x, y: p.y});
            }

            // Empties the ground and ceiling lists of points to create an empty environment with just the startpad.
            window.ground = [];
            window.ceiling = [];

            // Initializes the environment
            let terrainConfig = state.parkourConfig.terrain;
            let creepersConfig = state.parkourConfig.creepers;
            init_game(
                [terrainConfig.dim1, terrainConfig.dim2, terrainConfig.dim3],
                terrainConfig.waterLevel,
                creepersConfig.width,
                creepersConfig.height,
                creepersConfig.spacing,
                terrainConfig.smoothing,
                creepersConfig.type == 'Swingable',
                window.ground,
                window.ceiling,
                window.align_terrain,
                window.game.env.zoom,
                window.game.env.scroll
            );

            // Displays the drawing and forbidden canvas on top of the main canvas
            image(drawing_canvas, 0, -SCROLL_Y_MAX + window.game.env.scroll[1]);
            image(forbidden_canvas, 0, -SCROLL_Y_MAX + window.game.env.scroll[1]);
        }
        return state;
    },

    /**
     * Re-draws the terrain shapes on the drawing canvas.
     * @param state {Object} - UI state
     * @param payload
     * @return {Object} - UI state
     */
    refreshDrawing(state, payload){

        // Draws the forbidden red area on the forbidden canvas
        window.draw_forbidden_area();

        drawing_canvas.clear();

        // Horizontally sorts the ground points that have been drawn
        window.terrain.ground.sort(function (a, b) {
            return a.x - b.x;
        });

        // Horizontally sorts the ceiling points that have been drawn
        window.terrain.ceiling.sort(function (a, b) {
            return a.x - b.x;
        });

        // Draws the ground ground
        for(let i = 0; i < window.terrain.ground.length - 1; i++) {
            let p = window.terrain.ground[i];
            let p2 = window.terrain.ground[i + 1];
            let p_pos = convertPosEnvToCanvas(p.x, p.y);
            let p2_pos = convertPosEnvToCanvas(p2.x, p2.y);

            drawing_canvas.stroke("#66994D");
            drawing_canvas.strokeWeight(4);
            drawing_canvas.line(
                p_pos.x,
                p_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1],
                p2_pos.x,
                p2_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1]
            )
        }

        // Draws the ceiling
        for(let i = 0; i < window.terrain.ceiling.length - 1; i++) {
            let p = window.terrain.ceiling[i];
            let p2 = window.terrain.ceiling[i + 1];
            let p_pos = convertPosEnvToCanvas(p.x, p.y);
            let p2_pos = convertPosEnvToCanvas(p2.x, p2.y);

            drawing_canvas.stroke("#808080");
            drawing_canvas.strokeWeight(4);
            drawing_canvas.line(
                p_pos.x,
                p_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1],
                p2_pos.x,
                p2_pos.y + SCROLL_Y_MAX - window.game.env.scroll[1]
            )
        }

        return state;
    },

    /**
     * Draws or not all the joints of the environment and renders it.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    drawJoints(state, payload) {
        state.advancedOptionsState.drawJoints = payload;
        window.draw_joints = payload;
        window.game.env.render();
        return state;
    },

    /**
     * Draws or not all the lidars of the agents of the environment and renders it.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    drawLidars(state, payload) {
        state.advancedOptionsState.drawLidars = payload;
        window.draw_lidars = payload;
        window.game.env.render();
        return state;
    },

    /**
     * Draws or not all the names of the agents of the environment and renders it.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    drawNames(state, payload) {
        state.advancedOptionsState.drawNames = payload;
        window.draw_names = payload;
        window.game.env.render();
        return state;
    },

    /**
     * Draws or not the observation of the agents of the environment and renders it.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    drawObservation(state, payload) {
        state.advancedOptionsState.drawObservation = payload;
        window.draw_observation = payload;
        window.game.env.render();
        return state;
    },

    /**
     * Draws or not the reward of the agents of the environment and renders it.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    drawReward(state, payload) {
        state.advancedOptionsState.drawReward = payload;
        window.draw_reward = payload;
        window.game.env.render();
        return state;
    },

    /**
     * Starts (true) or exits (false) intro tour.
     * @param state {Object} - UI state
     * @param payload {boolean}
     * @return {Object} - UI state
     */
    setIntroTour(state, payload){
        state.simulationState.intro_tour = payload;

        // Shows the intro hints when exiting the guide tour
        if(!payload){
            window.introTour.addHints();
        }
        return state;
    },

    /**
     * Sets the language.
     * @param state {Object} - UI state
     * @param payload {string}
     * @return {Object} - UI state
     */
    setLanguage(state, payload) {
        state.language = payload;
        return state;
    }
};