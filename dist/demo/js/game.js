/**
 * @classdesc Class that handles the simulation.
 */
class Game {
    /**
     * @constructor
     * @param agents {{morphologies: Array, policies: Array, positions: Array}} - Morphologies, policies and positions of the agents
     * @param cppn_input_vector {Array} - 3-dimensional array that encodes the CPPN
     * @param water_level {number}
     * @param creepers_width {number}
     * @param creepers_height {number}
     * @param creepers_spacing {number}
     * @param smoothing {number}
     * @param creepers_type {boolean}
     * @param ground {Array} - List of points {x, y} composing the ground
     * @param ceiling {Array} - List of points {x, y} composing the ceiling
     * @param align_terrain {Object}
     */
    constructor(agents, cppn_input_vector, water_level, creepers_width, creepers_height,
                creepers_spacing, smoothing, creepers_type, ground, ceiling, align_terrain) {

        this.run_fps = 60;
        this.obs = [];
        this.rewards = [];
        this.initWorld(agents, cppn_input_vector, water_level, creepers_width, creepers_height, creepers_spacing, smoothing,
                        creepers_type, ground, ceiling, align_terrain);
        this.running = false;
    }

    /**
     * Initializes the environment.
     * @param agents {{morphologies: Array, policies: Array, positions: Array}} - Morphologies, policies and positions of the agents
     * @param cppn_input_vector {Array} - 3-dimensional array that encodes the CPPN
     * @param water_level {number}
     * @param creepers_width {number}
     * @param creepers_height {number}
     * @param creepers_spacing {number}
     * @param smoothing {number}
     * @param creepers_type {boolean}
     * @param ground {Array} - List of points {x, y} composing the ground
     * @param ceiling {Array} - List of points {x, y} composing the ceiling
     * @param align_terrain {Object}
     */
    initWorld(agents, cppn_input_vector, water_level, creepers_width, creepers_height, creepers_spacing,
              smoothing, creepers_type, ground, ceiling, align_terrain) {

        this.env = new MultiAgentsContinuousParkour(
            agents,
            3,
            smoothing,
            200,
            90,
            20,
            creepers_type,
            ground,
            ceiling,
            align_terrain);

        this.steps = 0;
        this.env.set_environment(cppn_input_vector, water_level, creepers_width, creepers_height, creepers_spacing, smoothing, creepers_type);
        let step_rets = this.env.reset();
        this.obs.push([...step_rets.map(e => e[0])]);
        this.rewards.push([...step_rets.map(e => e[1])]);
    }

    /**
     * Pauses the simulation.
     */
    pause(){
        clearInterval(this.runtime);
        this.running = false;
    }

    /**
     * Runs the simulation.
     * @returns {Promise<void>}
     */
    async run(){

        // Loads the policy for each agent before launching the simulation
        for(let agent of window.game.env.agents){
            if(agent.policy.path != null){
                agent.model = await tf.loadGraphModel('dist/' + agent.policy.path + '/model.json');
            }
            else{
                agent.model = null;
            }
        }

        // Creates a repeated interval over time
        this.runtime = setInterval(() => {
            this.play();
            this.steps += 1;
        }, 1000 / this.run_fps);
        this.running = true;
    }

    /**
     *
     * @param agents {{morphologies: Array, policies: Array, positions: Array}} - Morphologies, policies and positions of the agents
     * @param cppn_input_vector {Array} - 3-dimensional array that encodes the CPPN
     * @param water_level {number}
     * @param creepers_width {number}
     * @param creepers_height {number}
     * @param creepers_spacing {number}
     * @param smoothing {number}
     * @param creepers_type {boolean}
     * @param ground {Array} - List of points {x, y} composing the ground
     * @param ceiling {Array} - List of points {x, y} composing the ceiling
     * @param align_terrain {Object}
     */
    reset(agents, cppn_input_vector, water_level, creepers_width, creepers_height,
          creepers_spacing, smoothing, creepers_type, ground, ceiling, align_terrain, reset_zoom=true){

        this.pause();
        let zoom = reset_zoom ? window.game.env.initial_zoom : window.game.env.zoom;
        let scroll = [...window.game.env.scroll];
        this.initWorld(agents, cppn_input_vector, water_level, creepers_width, creepers_height, creepers_spacing, smoothing,
                        creepers_type, ground, ceiling, align_terrain);

        // Keeps the previous zoom and scroll
        window.game.env.set_zoom(zoom);
        window.game.env.set_scroll(null, scroll[0], scroll[1]);

        this.steps = 0;
        this.obs = [];
        this.rewards = [];
        let step_rets = this.env.step();
        this.obs.push([...step_rets.map(e => e[0])]);
        this.rewards.push([...step_rets.map(e => e[1])]);

        this.env.render();
    }

    /**
     * Plays one simulation step.
     */
    play() {
        const custom_agents = ["accel", "plr", "dr", "alp-gmm"];
        // Gets the actions to execute for each agent
        for(let agent of window.game.env.agents){
            let state = this.obs[this.obs.length - 1][agent.id];

            // Generates the actions thanks to the agent's policy model
            if(agent.model != null){
                let envState = tf.tensor(state,[1, state.length]);

                let inputs = {
                    "input_0": envState
                };

                // let output = 'main/mul:0'
                let output = 'output_0';

                agent.actions = agent.model.execute(inputs, output).arraySync()[0];
                
                // if(custom_agents.includes(agent.name)) {
                //     let inputs = {
                //         "input_0": envState
                //     };

                //     // let output = 'main/mul:0'
                //     let output = 'output_0';

                //     agent.actions = agent.model.execute(inputs, output).arraySync()[0];
                // }
                // else {
                //     let inputs = {
                //         "Placeholder_1:0": envState
                //     }

                //     let output = 'main/mul:0';

                //     agent.actions = agent.model.execute(inputs, output).arraySync();
                // }
            }

            // Generates random actions
            else /*if(agent.policy.name == "random")*/{
                agent.actions = Array.from({length: agent.agent_body.get_action_size()}, () => Math.random() * 2 - 1);
            }

            // Generates motionless actions
            /*else{
                agent.actions = Array.from({length: agent.agent_body.get_action_size()}, () => 0);
            }*/
        }

        // Runs one step and stores the resulted states for each agent
        let step_rets = this.env.step();
        this.obs.push([...step_rets.map(e => e[0])]);
        this.rewards.push([...step_rets.map(e => e[1])]);

        for(let agent of window.game.env.agents){
            if (agent.name == window.agent_name_followed) {
                let x = agent.agent_body.reference_head_object.m_xf.p.x;
                if (window.hasOwnProperty('furthest_agent_followed') && window.furthest_agent_followed != null) {
                    if (x > furthest_agent_followed.agent_body.reference_head_object.m_xf.p.x) {
                        window.furthest_agent_followed = agent;
                    }   
                }
                else {
                    window.furthest_agent_followed = agent;
                }
            }
        }
        

        this.env.render();
    }

    returns() {
        let num_agents = window.game.env.agents.length;

        let rewards = this.rewards.filter((r) => {
            return r.length == num_agents;
        });

        let returns = new Array(num_agents).fill(0);
        for (let t=0; t < rewards.length; t++) {
            for (let a=0; a<rewards[t].length;a++) {
                returns[a] += rewards[t][a];
            }
        }

        return returns;
    }

    regrets(normalize=false) {
        // Returns the regret for each agent training method by name
        let returns = this.returns();
        const game_agents = window.game.env.agents;

        let agent_name2returns = {};
        for (let i=0; i<game_agents.length; i++) {
            let agent = game_agents[i];
            if (agent_name2returns.hasOwnProperty(agent.name)) {
                agent_name2returns[agent.name].push(returns[i]);
            }
            else {
                agent_name2returns[agent.name] = [returns[i],];
            }
        }

        let agent_name2max_returns = {};
        let max_return = -9999999.0;
        for (const [name, returns] of Object.entries(agent_name2returns)) {
            let name_max = Math.max(...returns);
            if (name_max > max_return) {
                max_return = name_max;
            }
            agent_name2max_returns[name] = name_max;
        }

        let agent_regrets = {};
        for (const [name, agent_max_return] of Object.entries(agent_name2max_returns)) {
            agent_regrets[name] = max_return - agent_max_return;
            if (normalize) {
                agent_regrets[name] = agent_regrets[name]/max_return;
            }
        }

        agent_regrets['max_return'] = max_return

        return agent_regrets;
    }
}
