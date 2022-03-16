//region Constants

const FPS = 50;
const SCALE  = 30; // affects how fast-paced the game is, forces should be adjusted as well
const VIEWPORT_W = 600;
const VIEWPORT_H = 400;

let RENDERING_VIEWER_W = VIEWPORT_W;
let RENDERING_VIEWER_H = VIEWPORT_H

const NB_LIDAR = 10;
const LIDAR_RANGE = 160/SCALE;

const TERRAIN_STEP   = 14/SCALE;
// const TERRAIN_LENGTH = 200;     // in steps
const TERRAIN_LENGTH = 200;     // in steps
const TERRAIN_HEIGHT = VIEWPORT_H/SCALE/4;
const TERRAIN_END = 5;
const TERRAIN_GRASS = 10
const INITIAL_TERRAIN_STARTPAD = 20; // in steps
const FRICTION = 2.5;
const WATER_DENSITY = 1.0;
const CREEPER_UNIT = 1;

const SCROLL_X_MAX = 500;
const SCROLL_Y_MAX = 200;
// const INIT_SCROLL_X = -0.035 * RENDERING_VIEWER_W;
const INIT_SCROLL_X = 0;
const THUMBNAIL_SCROLL_X = 0;
let THUMBNAIL_ZOOM = 0.27;
let INIT_ZOOM = 0.27;

//endregion
const HARDCORE_CONFIG = {
    ground_roughness: [1,1],
    pit_gap: [3,5],
    stump_width: [1,3],
    stump_height: [1,3],
    stair_height: [1,3],
    stair_width: [4,5],
    stair_steps: [3,5]
}


function randomInt(min, max) {
    if(min == max) {
        return min;
    }

    return Math.floor(Math.random()*(max-min)) + min;
}

const AGENT_COLORS = {
    accel: {
        hull_fill: "#53E54C",
        hull_border: "#367F32",
        leg_fill: "#44C03E",
        leg_border: "#367F32"
    },
    plr: {
        hull_fill: "#E580E9",
        hull_border: "#965298",
        leg_fill: "#C56CC8",
        leg_border: "#965298"
    },
    alpgmm: {
        hull_fill: "#E9DC80",
        hull_border: "#948D5A",
        leg_fill: "#D2C774",
        leg_border: "#948D5A"
    },
    dr: {
        hull_fill: "#D6D6D6",
        hull_border: "#6F6F6F",
        leg_fill: "#BCBCBC",
        leg_border: "#6F6F6F"
    }
}

/**
 * @classdesc This environment can host multiple agents and its terrain can be generated either with lists of points for ground and ceiling or with a CPPN.
 */
class MultiAgentsContinuousParkour {

    /**
     * @constructor
     * @param agents {{morphologies: Array, policies: Array, positions: Array}} - Morphologies, policies and positions of the agents
     * @param input_CPPN_dim {number} - Dimension of the array that encodes the CPPN
     * @param [terrain_cppn_scale=10] {number} - Smoothing
     * @param [ceiling_offset=200] {number}
     * @param [ceiling_clip_offset=0] {number}
     * @param [water_clip=20] {number}
     * @param [movable_creepers=false] {boolean}
     * @param ground {Array} - List of points {x, y} composing the ground
     * @param ceiling {Array} - List of points {x, y} composing the ceiling
     * @param align_terrain {Object}
     */
    constructor(agents, input_CPPN_dim=3, terrain_cppn_scale=10,
                ceiling_offset=200, ceiling_clip_offset=0, water_clip=20,
                movable_creepers=false, ground, ceiling, align_terrain){

        // Initializes class attributes
        this.scale = SCALE;
        this.initial_zoom = INIT_ZOOM;
        this.zoom = INIT_ZOOM;
        this.movable_creepers = movable_creepers;
        this.terrain_bodies = [];
        this.background_polys = [];
        this.creepers_joints = [];
        this.ground = ground;
        this.ceiling = ceiling;
        this.align_terrain = align_terrain;

        // Initializes Box2D
        this.contact_listener = new ContactDetector(this);
        let gravity = new b2.Vec2(0, -10);
        this.world = new b2.World(gravity);
        this.world.SetContactListener(this.contact_listener);

        // Creates the agents
        this.agents = [];
        // console.assert(agents.morphologies.length == agents.policies.length && agents.morphologies.length == agents.positions.length);
        for(let i = 0; i < agents.morphologies.length; i++){
            if(!agents.hasOwnProperty('visible')) {
                agents.visible = Array(agents.length).fill(true);
            }
            this.create_agent(agents.morphologies[i], agents.policies[i], agents.positions[i], agents.visible[i]);
            //this.create_agent("spider", {name: "random", path: null}, null);
        }

        // Initializes dynamics
        // this.water_dynamics = new WaterDynamics(this.world.m_gravity);
        // this.climbing_dynamics = new ClimbingDynamics();

        // Creates the Box2D fixtures
        this.create_terrain_fixtures();

        // Initializes the CPPN and scales the terrain
        this.terrain_CPPN = new CPPN(TERRAIN_LENGTH, input_CPPN_dim);
        this.set_terrain_cppn_scale(terrain_cppn_scale, ceiling_offset, ceiling_clip_offset);
    }

    /**
     * Creates an agent with the given parameters.
     * @param morphology {string} - Name of the morphology
     * @param policy {{name: string, age: string, path: string}} - Name and path of the policy model
     * @param init_pos {{x: number, y: number}} - Initial position of the agent
     */
    create_agent(morphology, policy, init_pos, visible=true){

        let agent = {
            id: this.agents.length,
            name: policy.name,
            age: policy.age,
            is_selected: false,
            morphology: morphology,
            policy: policy,
            init_pos: init_pos,
            prev_shaping: null,
            episodic_reward: 0,
            visible: visible,
        };

        let colors = policy.name in AGENT_COLORS ? AGENT_COLORS[policy.name] : null;

        // Initializes the agent's body and lidars according to the morphology
        if(morphology == "bipedal") {
            agent.agent_body = new ClassicBipedalBody(SCALE, 80, 600, false, colors);
            agent.lidars_config = this.set_lidars_type("down");
        }
        else if(morphology == "chimpanzee") {
            agent.agent_body = new ClimbingProfileChimpanzee(SCALE);
            agent.lidars_config = this.set_lidars_type("up");
        }
        else if(morphology == "fish"){
            agent.agent_body = new FishBody(SCALE, 80, WATER_DENSITY, 600);
            agent.lidars_config = this.set_lidars_type("full");
        }
        else if(morphology == "spider"){
            agent.agent_body = new SpiderBody(SCALE);
            agent.lidars_config = this.set_lidars_type("down");
        }
        else {
            agent.agent_body = new ClassicBipedalBody(SCALE);
            agent.lidars_config = this.set_lidars_type("down");
        }

        // Adds the new agent to the list of agents
        if(visible) {
            this.agents.push(agent);
        }
    }

    /**
     * Seeds the random generator according to the terrain parameters.
     */
    seed(){
        // Creates a string with all the terrain parameters
        let seed = "";
        for(let dim of this.CPPN_input_vector){
            seed += dim;
        }
        seed += this.water_level;
        seed += this.TERRAIN_CPPN_SCALE;
        seed += this.creepers_width;
        seed += this.creepers_height;
        seed += this.creepers_spacing;
        seed += this.movable_creepers;;

        // Math.seedrandom(seed);
    }

    /**
     * Returns a lidars configuration according to the given type.
     * @param lidars_type {string} - 'down', 'up', or 'full'
     * @returns {{lidar_angle: number, lidar_y_offset: number}}
     */
    set_lidars_type(lidars_type){
        // Use 'down' for walkers, 'up' for climbers and 'full' for swimmers.
        let lidar_config = {};
        if(lidars_type == "down") {
            lidar_config.lidar_angle = 1.5;
            lidar_config.lidar_y_offset = 0;
        }
        else if(lidars_type == "up") {
            lidar_config.lidar_angle = 2.3;
            lidar_config.lidar_y_offset = 1.5;
        }
        else if(lidars_type == "full") {
            lidar_config.lidar_angle = Math.PI;
            lidar_config.lidar_y_offset = 0;
        }
        return lidar_config;
    }

    /**
     * Scales the terrain according to the smoothing.
     * @param terrain_cppn_scale {number} - Smoothing
     * @param ceiling_offset {number}
     * @param ceiling_clip_offset {number}
     */
    set_terrain_cppn_scale(terrain_cppn_scale, ceiling_offset, ceiling_clip_offset){
        console.assert(terrain_cppn_scale > 1);
        this.TERRAIN_CPPN_SCALE = terrain_cppn_scale;
        this.CEILING_LIMIT = 1000 / this.TERRAIN_CPPN_SCALE;
        this.GROUND_LIMIT = -1000 / INITIAL_TERRAIN_STARTPAD;
        this.ceiling_offset = ceiling_offset / this.TERRAIN_CPPN_SCALE;
        this.ceiling_clip_offset = ceiling_clip_offset / this.TERRAIN_CPPN_SCALE;
    }

    /**
     * Sets the parameters for terrain generation.
     * Must be called before `reset()`.
     * @param input_vector {Array} - 3-dimensional array that encodes the CPPN
     * @param water_level {number}
     * @param creepers_width {number}
     * @param creepers_height {number}
     * @param creepers_spacing {number}
     * @param terrain_cppn_scale {number} - Smoothing
     * @param movable_creepers {boolean}
     */
    set_environment(input_vector, water_level, creepers_width=null,
                    creepers_height=null, creepers_spacing=0.1, terrain_cppn_scale=10, movable_creepers){

        this.CPPN_input_vector = input_vector;
        this.water_level = water_level > 0 ? water_level : - 0.01;
        this.creepers_width = creepers_width;
        this.creepers_height = creepers_height;
        this.creepers_spacing = Math.max(0.01, creepers_spacing);
        this.movable_creepers = movable_creepers;
        this.set_terrain_cppn_scale(terrain_cppn_scale,
                          this.ceiling_offset * this.TERRAIN_CPPN_SCALE,
                      this.ceiling_clip_offset * this.TERRAIN_CPPN_SCALE);
        this.seed();
    }

    /**
     * Destroys all the bodies composing the terrain and the agents
     */
    _destroy(){
        this.world.SetContactListener(null);
        for(let t of this.terrain_bodies){
            this.world.DestroyBody(t.body);
        }
        this.terrain_bodies = [];
        this.creepers_joints = [];
        for(let agent of this.agents){
            agent.agent_body.destroy(this.world);
        }
    }

    /**
     * Resets the environment.
     * @returns {*[]} - Array that contains the observation state and reward of each agent.
     */
    reset(){
        this._destroy();
        this.contact_listener = new ContactDetector(this);
        this.world.SetContactListener(this.contact_listener);
        this.scroll = [0, 0];
        this.water_y = this.GROUND_LIMIT;
        this.assets_bodies = [];

        for(let agent of this.agents){
            agent.nb_steps_outside_water = 0;
            agent.nb_steps_under_water = 0;
            agent.critical_contact = false;
        }

        // Generates the terrain and the agents
        this.generate_game();

        // Initializes all the agents
        for(let agent of this.agents) {
            this.init_agent(agent);
        }

        // Runs a simulation step and returns the results
        return this.step();
    }

    /**
     * Initializes the given agent.
     * @param agent {Object}
     */
    init_agent(agent){
        // Creates the lidars of the agent
        agent.lidars = [];
        for(let i = 0; i < NB_LIDAR; i++){
            agent.lidars.push(new LidarCallback(agent.agent_body.reference_head_object.GetFixtureList().GetFilterData().maskBits));
        }

        // Initializes the agent with motionless actions
        agent.actions = Array.from({length: agent.agent_body.get_action_size()}, () => 0);

        agent.nb_steps_outside_water = 0;
        agent.nb_steps_under_water = 0;
        agent.episodic_reward = 0;
    }

    /**
     * Initializes the position of the given climber agent so that it hangs from the ceiling.
     * @param agent {Object}
     */
    init_climber_pos(agent){
        let y_diff = 0;
        for(let i = 0; i < agent.agent_body.sensors.length; i++){

            // Tells this sensor to grasp
            agent.actions[agent.actions.length - i - 1] = 1;

            let sensor = agent.agent_body.sensors[agent.agent_body.sensors.length - i - 1];
            let sensor_position = sensor.GetPosition();

            // Finds the best y-coordinate of the ceiling according to the x-coordinate of the sensor
            let ceiling_y = find_best_y(sensor_position.x, this.terrain_ceiling);

            // Computes the vertical offset
            if(y_diff == 0){
                y_diff = ceiling_y - sensor_position.y;
            }

            // Sets the position of the sensor
            sensor.SetTransform(new b2.Vec2(sensor_position.x, ceiling_y),
                sensor.GetAngle());
        }

        // Shifts the position of each body part by the vertical offset
        for(let body_part of agent.agent_body.body_parts){
            let body_part_pos = body_part.GetPosition();
            body_part.SetTransform(new b2Vec2(body_part_pos.x, body_part_pos.y + y_diff),
                body_part.GetAngle());
        }
    }

    /**
     * Runs one step and updates the observation of the agents
     * @returns {Array} - List of return of each agent : [state, reward, done, {success: boolean}]
     */
    step(){
        // Checks if agents are dead according to their morphology
        for(let agent of this.agents){
            if(agent.nb_steps_under_water > agent.agent_body.nb_steps_can_survive_under_water){
                agent.is_dead = true;
                agent.actions = Array.from({length: agent.agent_body.get_action_size()}, () => 0);
            }
            else{
                agent.is_dead = false;
            }

            // Makes the agent moves according to its actions
            agent.agent_body.activate_motors(agent.actions);

            // Prepares climbing dynamics according to the grasping actions (i.e. readies sensor to grasp or release sensor grip by destroying joint)
            if(agent.agent_body.body_type == BodyTypesEnum.CLIMBER){
                this.climbing_dynamics.before_step_climbing_dynamics(agent.actions, agent.agent_body, this.world);
            }
        }

        // Updates Box2D world
        //this.world.Step(1.0 / FPS, 45, 15);
        this.world.Step(1.0 / FPS, 3 * 30, 1 * 30);

        // Filters null fixture pairs to avoid errors with water collisions
        this.world.m_contactManager.m_contactListener.water_contact_detector.fixture_pairs = this.world.m_contactManager.m_contactListener.water_contact_detector.fixture_pairs.filter(function(fp, index, array){
            return fp[0].GetShape() != null && fp[1].GetShape() != null;
        });

        let ret = [];

        // Observation state for each agent
        for(let agent of this.agents) {
            let head = agent.agent_body.reference_head_object;
            let pos = head.GetPosition();
            let vel = head.GetLinearVelocity();

            this.update_lidars(agent);

            let is_under_water = pos.y <= this.water_y;
            if(!agent.is_dead){
                if(is_under_water){
                    agent.nb_steps_under_water += 1;
                    agent.nb_steps_outside_water = 0;
                }
                else{
                    agent.nb_steps_under_water = 0;
                    agent.nb_steps_outside_water += 1;
                }
            }

            let state = [
                head.GetAngle(), // Normal angles up to 0.5 here, but sure more is possible.
                2.0 * head.GetAngularVelocity() / FPS,
                0.3 * vel.x * (VIEWPORT_W / SCALE) / FPS, // Normalized to get [-1, 1] range
                0.3 * vel.y * (VIEWPORT_H / SCALE) / FPS,
                // is_under_water ? 1.0 : 0.0,
                // agent.is_dead ? 1.0 : 0.0
            ];

            // Adds motor-related state
            state = state.concat(agent.agent_body.get_motors_state());

            // Adds sensor-related state for climbers
            if(agent.agent_body.body_type == BodyTypesEnum.CLIMBER){
                state = state.concat(agent.agent_body.get_sensors_state());
            }

            // Adds lidar-related state with distance and surface detected
            let nb_of_water_detected = 0;
            let surface_detected = [];
            for(let lidar of agent.lidars){
                state.push(lidar.fraction);
                if(lidar.is_water_detected){
                    surface_detected.push(-1);
                    nb_of_water_detected += 1;
                }
                else if(lidar.is_creeper_detected){
                    surface_detected.push(1)
                }
                else{
                    surface_detected.push(0);
                }
            }
            // state = state.concat(surface_detected)

            // console.log('Final:', state.length, state)

            let shaping = 130 * pos.x / SCALE; // moving forward is a way to receive reward (normalized to get 300 on completion)
            if(agent.agent_body.remove_reward_on_head_angle){
                shaping -= 5.0 * Math.abs(state[0]); // keep head straight, other than that and falling, any behavior is unpunished
            }

            let reward = 0;
            if(agent.prev_shaping != null){
                reward = shaping - agent.prev_shaping;
            }
            agent.prev_shaping = shaping;

            for(let a of agent.actions){
                reward -= agent.agent_body.TORQUE_PENALTY * 80 * Math.max(0, Math.min(Math.abs(a), 1));
                // normalized to about -50.0 using heuristic, more optimal agent should spend less
            }

            // Ending conditions
            let done = false;
            if(agent.critical_contact || pos.x < 0){
                reward -= 100;
                done = true;
            }
            if(pos.x > (TERRAIN_LENGTH + INITIAL_TERRAIN_STARTPAD - TERRAIN_END) * TERRAIN_STEP){
                done = true;
            }
            agent.episodic_reward += reward;

            ret.push([state, reward, done, {"success": agent.episodic_reward > 230}]);
        }

        return ret;
    }

    /**
     * Updates the lidars of the given agent by casting a ray for each lidar.
     * @param agent {Object}
     */
    update_lidars(agent){
        let pos = agent.agent_body.reference_head_object.GetPosition();
        for(let i = 0; i < NB_LIDAR; i++){
            agent.lidars[i].fraction = 1.0;
            agent.lidars[i].p1 = pos;
            agent.lidars[i].p2 = new b2.Vec2(
                pos.x + Math.sin(agent.lidars_config.lidar_angle * i / NB_LIDAR + agent.lidars_config.lidar_y_offset) * LIDAR_RANGE,
                pos.y - Math.cos(agent.lidars_config.lidar_angle * i / NB_LIDAR + agent.lidars_config.lidar_y_offset) * LIDAR_RANGE
            );
            this.world.RayCast(agent.lidars[i], agent.lidars[i].p1, agent.lidars[i].p2);
        }
    }

    /**
     * Closes the environment.
     */
    close(){
        this.world.SetContactListener(null);
        this.contact_listener.Reset();
        this._destroy();
    }

    // region Rendering
    // ------------------------------------------ RENDERING ------------------------------------------

    /**
     * Renders the environment.
     */
    render() {
        // Calls p5.js draw function once
        redraw();
    }

    /**
     * Sets the rendering viewer variables.
     * @param width {number}
     * @param height {number}
     * @param keep_ratio {boolean}
     */
    _SET_RENDERING_VIEWPORT_SIZE(width, height=null, keep_ratio=true){
        RENDERING_VIEWER_W = width;
        if(keep_ratio || height == null){
            RENDERING_VIEWER_H = Math.floor(RENDERING_VIEWER_W / (2 * VIEWPORT_W / VIEWPORT_H));
        }
        else{
            RENDERING_VIEWER_H = height;
        }
    }
    //endregion

    //region Fixtures Initialization
    // ------------------------------------------ FIXTURES INITIALIZATION ------------------------------------------

    /**
     * Creates all the Box2D fixtures to be used to generate the terrain.
     */
    create_terrain_fixtures(){
        // Polygon fixture
        this.fd_polygon = new b2.FixtureDef();
        this.fd_polygon.shape = new b2.PolygonShape();
        let vertices = [
            new b2.Vec2(0, 0),
            new b2.Vec2(1, 0),
            new b2.Vec2(1, -1),
            new b2.Vec2(0, -1)];
        this.fd_polygon.shape.Set(vertices, 4);
        this.fd_polygon.friction = FRICTION;
        this.fd_polygon.filter.categoryBits = 0x1;
        this.fd_polygon.filter.maskBits = 0xFFFF;

        // Edge fixture
        this.fd_edge = new b2.FixtureDef();
        this.fd_edge.shape = new b2.EdgeShape();
        this.fd_edge.shape.Set(new b2.Vec2(0, 0), new b2.Vec2(1, 1));
        this.fd_edge.friction = FRICTION;
        this.fd_edge.filter.categoryBits = 0x1;
        this.fd_edge.filter.maskBits = 0xFFFF;

        // Water fixture
        // this.fd_water = new b2.FixtureDef();
        // this.fd_water.shape = new b2.PolygonShape();
        // vertices = [
        //     new b2.Vec2(0, 0),
        //     new b2.Vec2(1, 0),
        //     new b2.Vec2(1, -1),
        //     new b2.Vec2(0, -1)];
        // this.fd_water.shape.Set(vertices, 4);
        // this.fd_water.density = WATER_DENSITY;
        // this.fd_water.isSensor = true;

        // Creeper fixture
        // this.fd_creeper = new b2.FixtureDef();
        // this.fd_creeper.shape = new b2.PolygonShape();
        // vertices = [
        //     new b2.Vec2(0, 0),
        //     new b2.Vec2(1, 0),
        //     new b2.Vec2(1, -1),
        //     new b2.Vec2(0, -1)];
        // this.fd_creeper.shape.Set(vertices, 4);
        // this.fd_creeper.density = 5.0;
        // this.fd_creeper.isSensor = true;

        // // Circle fixture
        // this.fd_circle = new b2.FixtureDef();
        // this.fd_circle.shape = new b2.CircleShape();
        // this.fd_circle.density = 5.0;
        // this.fd_circle.friction = FRICTION;
        // this.fd_circle.filter.categoryBits = 0x1;
        // this.fd_circle.filter.maskBits = 0xFFFF;

    }
    //endregion

    // region Game Generation
    // ------------------------------------------ GAME GENERATION ------------------------------------------

    /**
     * Generates the different elements of the environment.
     */
    generate_game(){
        this._generate_terrain();
        this._generate_clouds();

        for(let agent of this.agents){
            this._generate_agent(agent);
        }
    }

    _create_terrain_body(poly, type) {
        this.fd_polygon.shape = new b2.PolygonShape();
        let vertices = [];
        for(let vertex of poly) {
            vertices.push(new b2.Vec2(vertex[0], vertex[1]))
        };
        this.fd_polygon.shape.Set(vertices, vertices.length);
        let body_def = new b2.BodyDef();
        body_def.type = b2.Body.b2_staticBody;
        let t = this.world.CreateBody(body_def);
        t.CreateFixture(this.fd_polygon);
        t.SetUserData(new CustomUserData("pit", CustomUserDataObjectTypes.TERRAIN));

        return t;
    }

    _merge_current_config(config) {
        if (window.hasOwnProperty('envConfig')) {
            for (var k in window.envConfig) {
                config[k] = window.envConfig[k];
            }
        }

        return config;
    }

    full_level_description() {
        let body_infos = this.terrain_bodies.filter((body_info) => {
            return body_info.body.m_fixtureList.m_shape.hasOwnProperty('m_vertices');
        });

        let terrain_bodies = body_infos.map((body_info) => {
            let vertices = body_info.body.m_fixtureList.m_shape.m_vertices.map((v) => {
                return {x: v.x, y: v.y};
            });

            return {
                type: body_info.type,
                vertices: vertices
            }
        });

        let description = {
            terrain_ground: this.terrain_ground,
            terrain_bodies: terrain_bodies
        };

        return description;
    }

    _generate_grass(ranges=null) {
        // Hardcore config
        const config = HARDCORE_CONFIG;
        this._merge_current_config(config);

        const GRASS = 0;
        const STUMP = 1;
        const STAIRS = 2;
        const PIT = 3;
        const _STATES_ = 4;

        let state = GRASS;
        let velocity = 0;

        let counter = INITIAL_TERRAIN_STARTPAD;
        let oneshot = false;

        let terrain_x = [];
        let terrain_y = [];

        let y = TERRAIN_HEIGHT;
        let original_y = y;

        let body_def = new b2.BodyDef();
        body_def.type = b2.Body.b2_staticBody;
        let t = this.world.CreateBody(body_def);

        let ground_roughness = randomInt(config.ground_roughness[0], config.ground_roughness[1]);

        for(let i = 0; i < TERRAIN_LENGTH; i++) {
            let x = i*TERRAIN_STEP
            terrain_x.push(x);

            if(state == GRASS) {
                velocity = 0.8*velocity + 0.01*Math.sign(TERRAIN_HEIGHT - y);
                if(i > INITIAL_TERRAIN_STARTPAD) {
                    velocity += (Math.random()*2 - 1)/SCALE;
                }
                y += ground_roughness*velocity;
            }   

            else if(state==PIT && oneshot) {
                // counter = randomInt(3,5);
                var pit_gap = randomInt(config.pit_gap[0],config.pit_gap[1])
                if (pit_gap > 0) {
                    counter = Math.max(Math.ceil(pit_gap), 1.0)
                    var pit_diff = counter - pit_gap

                    // Left side
                    let poly = [
                        [x,              y],
                        [x+TERRAIN_STEP, y],
                        [x+TERRAIN_STEP, y-4*TERRAIN_STEP],
                        [x,              y-4*TERRAIN_STEP],
                    ];
                    let t = this._create_terrain_body(poly, "pit");
                    let poly_data = {
                        type : "pit",
                        color1: "FFFFFF", //[1,1,1],
                        color2: "#999999", // [0.6,0.6,0.6],
                        body: t
                    };
                    this.terrain_bodies.push(poly_data);

                    // Right side
                    let poly2 = [];
                    for(let p of poly) {
                        // poly2.push([p[0]+TERRAIN_STEP*counter, p[1]])
                        poly2.push([p[0]+TERRAIN_STEP*pit_gap, p[1]])
                    };
                    t = this._create_terrain_body(poly2, "pit");
                    poly_data = {
                        type : "pit",
                        color1: "FFFFFF", //[1,1,1],
                        color2: "#999999", // [0.6,0.6,0.6],
                        body: t
                    };
                    this.terrain_bodies.push(poly_data);

                    counter += 2;
                    original_y = y;
                }
            }
            else if(state==PIT && !oneshot && pit_gap > 0) {
                y = original_y;
                if(counter > 1) {
                    y -= 4*TERRAIN_STEP;
                }
                if(counter == 1) {
                    terrain_x[terrain_x.length-1] = terrain_x[terrain_x.length-1] - pit_diff*TERRAIN_STEP;   
                    pit_diff = 0;
                }
            }
            else if(state==STUMP && oneshot) {
                // counter = Math.floor(Math.random() * 2) + 1
                let stump_width = randomInt(config.stump_width[0], config.stump_width[1]);
                let stump_height = randomInt(config.stump_height[0], config.stump_height[1]);
                counter = stump_width;
                var counter_y = stump_height;

                if (counter > 0 && counter_y > 0) {
                    let poly = [
                        [x,                      y],
                        [x+counter*TERRAIN_STEP, y],
                        [x+counter*TERRAIN_STEP, y+counter_y*TERRAIN_STEP],
                        [x,                      y+counter_y*TERRAIN_STEP],
                    ];   

                    let t = this._create_terrain_body(poly, "stump");
                    let poly_data = {
                        type : "stump",
                        color1: "FFFFFF", //[1,1,1],
                        color2: "#999999", // [0.6,0.6,0.6],
                        body: t
                    };
                    this.terrain_bodies.push(poly_data);
                }
            }

            else if(state==STAIRS && oneshot) {
                var stair_height = randomInt(config.stair_height[0], config.stair_height[1]);
                var stair_width = randomInt(config.stair_width[0], config.stair_width[1]);
                var stair_steps = randomInt(config.stair_steps[0], config.stair_steps[1]);

                // var stair_height = 1; 
                // if(Math.random() > 0.5) {
                //     stair_height = 1;
                // }
                var stair_slope = 1; 
                if(Math.random() > 0.5) {
                    stair_slope = -1;
                }

                if(stair_slope > 0) {
                    stair_height = Math.min(stair_height, 1);
                }

                // var stair_width = Math.floor(Math.random()*(5-4)) + 4;
                // var stair_steps = Math.floor(Math.random()*(5-3)) + 3;

                original_y = y
                for(let s=0; s < stair_steps; s++) {
                    let poly = [
                        [x+(s*stair_width)*TERRAIN_STEP, y+stair_height*(s*stair_slope)*TERRAIN_STEP],
                        [x+((1+s)*stair_width)*TERRAIN_STEP, y+stair_height*(s*stair_slope)*TERRAIN_STEP],
                        [x+((1+s)*stair_width)*TERRAIN_STEP, y+stair_height*(-1+s*stair_slope)*TERRAIN_STEP],
                        [x+(s*stair_width)*TERRAIN_STEP, y+stair_height*(-1+s*stair_slope)*TERRAIN_STEP],
                    ]

                    let t = this._create_terrain_body(poly, "stairs");
                    let poly_data = {
                        type : "stairs",
                        color1: "FFFFFF", //[1,1,1],
                        color2: "#999999", // [0.6,0.6,0.6],
                        body: t
                    };
                    this.terrain_bodies.push(poly_data);
                }

                counter = stair_steps*stair_width + 1;
            }

            else if(state==STAIRS && !oneshot) {
                // let s = stair_steps*stair_width - counter - stair_height;
                let s = stair_steps*stair_width - counter;
                if (stair_slope == 1) {
                    s -= stair_height;
                }
                let n = s/stair_width;
                // y = original_y + (n*stair_height)*TERRAIN_STEP;
                y = original_y + (n * stair_height * stair_slope) * TERRAIN_STEP;
                if(stair_slope == -1) {
                    // y -= stair_height*TERRAIN_STEP;
                }
            }

            oneshot = false
            terrain_y.push(y);
            counter -= 1

            if(counter==0) {
                counter = Math.floor(Math.random() * TERRAIN_GRASS) + TERRAIN_GRASS/2
                if(state==GRASS) { 
                    state = Math.floor(Math.random() * _STATES_) + 1;
                    oneshot = true;
                }
                else {
                    state = GRASS;
                    oneshot = true;
                }
            }
        }

        this.terrain_bodies = this.terrain_bodies.reverse()

        for(let i = 0; i < TERRAIN_LENGTH; i++){
            this.terrain_ground.push({x: terrain_x[i], y: terrain_y[i]});
        }
    }

    /**
     * Generates all the Box2D bodies composing the terrain.
     */
    _generate_terrain(){
        console.log('Called _generate_terrain')
        // Arrays to contain the actual points of ground and ceiling
        this.terrain_ground = [];
        this.terrain_ceiling = [];
        this.terrain_bodies = [];

        // Smooths ground and ceiling by removing points that are too close in order to reduce the number of bodies created
        let ground = smoothTerrainFiler(this.ground, TERRAIN_STEP);
        let ceiling = smoothTerrainFiler(this.ceiling, TERRAIN_STEP);

        // Creates startpad
        for(let i = 0; i < INITIAL_TERRAIN_STARTPAD; i++){
            this.terrain_ground.push({x: i * TERRAIN_STEP, y: TERRAIN_HEIGHT});
            this.terrain_ceiling.push({x: i * TERRAIN_STEP, y: TERRAIN_HEIGHT + this.ceiling_offset});
        }

        this._generate_grass();

        /* DRAWING GENERATION: generates the terrain from the ground and ceiling arrays of points */
        if(window.is_drawing() || ground.length > 0 || ceiling.length > 0){
            console.log('Called drawing generation...')
        }
        /* CPPN GENERATION: generates the terrain from the output of the CPPN model encoded with the input vector */
        else{
            console.log('Called CPPN generation')
            let cppn_y = this.terrain_CPPN.generate(this.CPPN_input_vector).arraySync();
            cppn_y = cppn_y.map(e => [e[0] / this.TERRAIN_CPPN_SCALE, e[1] / this.TERRAIN_CPPN_SCALE]);

            console.log('CPNN y is', cppn_y)

            // Gets y values for the ground and aligns them with the startpad
            let ground_offset = TERRAIN_HEIGHT - cppn_y[0][0];
            let cppn_ground_y = cppn_y.map(e => e[0] + ground_offset);

            // Gets y values for the ceiling and aligns them with the startpad
            let ceiling_offset = TERRAIN_HEIGHT + this.ceiling_offset - cppn_y[0][1];
            let cppn_ceiling_y = cppn_y.map(e => e[1] + ceiling_offset);

            // Pushes the terrain values in the lists
            for(let i = 0; i < TERRAIN_LENGTH; i++){
                this.terrain_ground.push({x: (INITIAL_TERRAIN_STARTPAD + i) * TERRAIN_STEP, y: cppn_ground_y[i]});

                // Clips ceiling so that it does not overlaps the ground
                let ceiling_val = cppn_ground_y[i] + this.ceiling_clip_offset;
                if(cppn_ceiling_y[i] >= ceiling_val){
                    ceiling_val = cppn_ceiling_y[i];
                }
                this.terrain_ceiling.push({x: (INITIAL_TERRAIN_STARTPAD + i) * TERRAIN_STEP, y: ceiling_val});
            }
        }

        // Stores the terrain shapes (without the startpad) in global variables
        window.ground = [...this.terrain_ground];
        window.ground.splice(0, INITIAL_TERRAIN_STARTPAD);
        window.ceiling = [...this.terrain_ceiling];
        window.ceiling.splice(0, INITIAL_TERRAIN_STARTPAD);

        /* BOX2D TERRAIN CREATION */
        // this.terrain_bodies = [];
        this.background_polys = [];
        let poly;
        let poly_data;

        // Water
        this.min_ground_y = Math.min(...this.terrain_ground.map(p => p.y));
        this.air_max_distance = Math.max(...this.terrain_ceiling.map(p => p.y)) - this.min_ground_y;

        let body_def = new b2.BodyDef();
        body_def.type = b2.Body.b2_staticBody;
        let t = this.world.CreateBody(body_def);

        // Ground
        let grass_terrain_bodies = [];
        for(let i = 0; i < this.terrain_ground.length - 1; i++){
            poly = [
                [this.terrain_ground[i].x, this.terrain_ground[i].y],
                [this.terrain_ground[i + 1].x, this.terrain_ground[i + 1].y]
            ];
            this.fd_edge.shape.Set(new b2.Vec2(poly[0][0], poly[0][1]),
                new b2.Vec2(poly[1][0], poly[1][1]));
            let body_def = new b2.BodyDef();
            body_def.type = b2.Body.b2_staticBody;
            let t = this.world.CreateBody(body_def);
            t.CreateFixture(this.fd_edge);
            t.SetUserData(new CustomUserData("grass", CustomUserDataObjectTypes.TERRAIN));
            let color = i % 2 == 0 ? "#4dff4d" : "#4dcc4d"; // [0.3, 1.0, 0.3] : [0.3, 0.8, 0.3]
            poly_data = {
                type : "ground",
                color : color,
                body : t,
            }
            grass_terrain_bodies.push(poly_data);

            // Visual poly to fill the ground
            if(i <= this.terrain_ground.length / 2){
                poly.push([poly[1][0] + 10 * TERRAIN_STEP, 2 * this.GROUND_LIMIT]);
                poly.push([poly[0][0], 2 * this.GROUND_LIMIT]);
            }
            else{
                poly.push([poly[1][0], 2 * this.GROUND_LIMIT]);
                poly.push([poly[0][0] - 10 * TERRAIN_STEP, 2 * this.GROUND_LIMIT]);
            }

            color = "#66994D"; //[0.4, 0.6, 0.3];
            poly_data = {
                type : "ground",
                color : color,
                vertices : poly,
            }
            this.background_polys.push(poly_data);
        }

        this.terrain_bodies = grass_terrain_bodies.concat(this.terrain_bodies);
    }

    /**
     * Generates random clouds.
     */
    _generate_clouds(){
        this.cloud_polys = [];
        for(let i = 0; i < Math.ceil(TERRAIN_LENGTH/10); i++){
            let x = (Math.random() * 5 * TERRAIN_LENGTH - TERRAIN_LENGTH) * TERRAIN_STEP;
            let y = Math.random() * RENDERING_VIEWER_H/SCALE + RENDERING_VIEWER_H/SCALE * 1/5;
            let poly = [];
            for(let a = 0; a < 10; a++){
                poly.push([
                    x + 15 * TERRAIN_STEP * Math.sin(Math.PI * 2 * a / 5) + Math.random() * (0 - 5 * TERRAIN_STEP) + 5 * TERRAIN_STEP,
                    y + 5 * TERRAIN_STEP * Math.cos(Math.PI * 2 * a / 5) + Math.random() * (0 - 5 * TERRAIN_STEP) + 5 * TERRAIN_STEP
                ])
            }
            let x1 = Math.min(...poly.map(p => p[0]));
            let x2 = Math.max(...poly.map(p => p[0]));
            this.cloud_polys.push({poly: poly, x1: x1, x2: x2});
        }
    }

    /**
     * Generates the given agent by computing its initial position and creating its physics body.
     * @param agent {Object}
     * @param init_x {number}
     * @param init_y {number}
     */
    _generate_agent(agent, init_x=null, init_y=null){

        if(init_x == null){
            // If an init_pos is given for the agent (reset due to terrain reshaping), init_y is computed accordingly
            if(agent.init_pos != null){
                init_x = agent.init_pos.x;

                // Computes the best y position corresponding to init_x to always generate the walkers on the ground
                if (agent.agent_body.body_type == BodyTypesEnum.WALKER) {
                    init_y = find_best_y(init_x, this.terrain_ground) + agent.agent_body.AGENT_CENTER_HEIGHT;
                }

                // Computes the best y position corresponding to init_x to always generate the swimmers between the ground and the ceiling
                else if(agent.agent_body.body_type == BodyTypesEnum.SWIMMER){
                    let y_ground = find_best_y(init_x, this.terrain_ground, agent.agent_body.AGENT_WIDTH);
                    if(y_ground == null){
                        y_ground = -Infinity;
                    }
                    let y_ceiling = find_best_y(init_x, this.terrain_ceiling, agent.agent_body.AGENT_WIDTH);
                    if(y_ceiling == null){
                        y_ceiling = Infinity;
                    }
                    init_y = Math.max(y_ground + 4 * agent.agent_body.AGENT_CENTER_HEIGHT, Math.min(y_ceiling - 4 * agent.agent_body.AGENT_CENTER_HEIGHT, agent.init_pos.y));
                }
            }

            // If no init_pos is given (add_agent), the agent is generated on the startpad
            else{
                init_x = TERRAIN_STEP * INITIAL_TERRAIN_STARTPAD / 2;

                // Sets init_y position according to the agent
                init_y = TERRAIN_HEIGHT + agent.agent_body.AGENT_CENTER_HEIGHT;
                if(agent.agent_body.body_type == BodyTypesEnum.SWIMMER){
                    init_y = TERRAIN_HEIGHT + 4 * agent.agent_body.AGENT_CENTER_HEIGHT;
                }
            }
        }

        // Creates the Box2D bodies of the agent's morphology
        agent.agent_body.draw(this.world, init_x, init_y, 0);
        agent.actions = Array.from({length: agent.agent_body.get_action_size()}, () => 0);

        // If the agent is a climber, initializes its position
        if(agent.agent_body.body_type == BodyTypesEnum.CLIMBER){
            this.init_climber_pos(agent);
        }
    }

    /**
     * Sets the position of an agent.
     * @param agent {Object}
     * @param init_x {number}
     * @param init_y {number}
     */
    set_agent_position(agent, init_x, init_y) {
        agent.agent_body.destroy(this.world);

        if (agent.agent_body.body_type == BodyTypesEnum.WALKER) {
            // Computes the best y position corresponding to init_x to always generate the walkers on the ground
            init_y = find_best_y(init_x, this.terrain_ground) + agent.agent_body.AGENT_CENTER_HEIGHT;
        }

        // Computes the best y position corresponding to init_x to always generate the swimmers between the ground and the ceiling
        else if(agent.agent_body.body_type == BodyTypesEnum.SWIMMER){
            let y_ground = find_best_y(init_x, this.terrain_ground, agent.agent_body.AGENT_WIDTH);
            if(y_ground == null){
                y_ground = -Infinity;
            }
            let y_ceiling = find_best_y(init_x, this.terrain_ceiling, agent.agent_body.AGENT_WIDTH);
            if(y_ceiling == null){
                y_ceiling = Infinity;
            }
            init_y = Math.max(y_ground + 4 * agent.agent_body.AGENT_CENTER_HEIGHT, Math.min(y_ceiling - 4 * agent.agent_body.AGENT_CENTER_HEIGHT, init_y));
        }

        this._generate_agent(agent, init_x, init_y);
        this.update_lidars(agent);
    }

    /**
     * Sets the scroll to follow the given agent or to the given values.
     * @param agent {Object}
     * @param h {number} - Horizontal scroll
     * @param v {number} - Vertical scroll
     */
    set_scroll(agent=null, h=null, v=null){
        let terrain_length = Math.max(this.terrain_ground[this.terrain_ground.length - 1].x, this.terrain_ceiling[this.terrain_ceiling.length - 1].x);

        // Sets the scroll to follow the agent
        if(agent != null){
            let x = agent.agent_body.reference_head_object.GetPosition().x;
            let y = agent.agent_body.reference_head_object.GetPosition().y;

            this.scroll = [
                (x * this.scale - RENDERING_VIEWER_W/5) * this.zoom,
                (y * this.scale - RENDERING_VIEWER_H * 2/5)  * this.zoom
            ];
        }

        // Adjusts the scroll when dragging an agent outside of the canvas
        else if(window.is_dragging_agent){

            if(window.dragging_side == "left"){
                this.scroll[0] = window.agent_selected.agent_body.reference_head_object.GetPosition().x * this.scale * this.zoom - RENDERING_VIEWER_W * (0.1 + 0.05)
            }
            else if(window.dragging_side == "right"){
                this.scroll[0] = window.agent_selected.agent_body.reference_head_object.GetPosition().x * this.scale * this.zoom - RENDERING_VIEWER_W * (0.85 + 0.05)
            }

            // Adjusts the vertical scroll to follow the vertical position of the agent
            this.scroll[1] = (window.agent_selected.agent_body.reference_head_object.GetPosition().y * this.scale - RENDERING_VIEWER_H * 2/5)  * this.zoom;
        }

        // Sets the scroll to the given values
        else{
            this.scroll = [h, v];
        }

        // Clamps scroll both horizontally and vertically when drawing
        if(window.is_drawing()){
            this.scroll[0] = Math.max(INIT_SCROLL_X, Math.min(this.scroll[0], TERRAIN_LENGTH * TERRAIN_STEP * this.scale * this.zoom - RENDERING_VIEWER_W * 0.9 + SCROLL_X_MAX));
            // this.scroll[0] = Math.max(INIT_SCROLL_X, Math.min(this.scroll[0], SCROLL_X_MAX));
            this.scroll[1] = Math.max(-SCROLL_Y_MAX, Math.min(this.scroll[1], SCROLL_Y_MAX));
        }
        else{
            // Clamps scroll only horizontally when not drawing
            this.scroll[0] = Math.max(INIT_SCROLL_X, Math.min(this.scroll[0], terrain_length * this.scale * this.zoom - RENDERING_VIEWER_W));
            // this.scroll[0] = Math.max(INIT_SCROLL_X, Math.min(this.scroll[0], 100));
        }
    }

    /**
     * Sets the zoom to the given value and clamps it in the authorized range.
     * @param zoom
     */
    set_zoom(zoom){
        this.zoom = Math.max(0.2525, Math.min(parseFloat(zoom), 1.5));
    }

    /**
     * Adds an agent to the environment, initializes it and runs one step.
     * @param morphology {string}
     * @param policy {{name: string, path: string}}
     * @param pos {{x: number, y: number}}
     */
    add_agent(morphology, policy, pos){
        this.create_agent(morphology, policy, pos);
        if(pos != null){
            this._generate_agent(this.agents[this.agents.length - 1], pos.x, pos.y);
        }
        else{
            this._generate_agent(this.agents[this.agents.length - 1]);
        }
        this.init_agent(this.agents[this.agents.length - 1]);
        let step_rets = this.step();
        window.game.obs.push([...step_rets.map(e => e[0])]);
        window.game.rewards.push([...step_rets.map(e => e[1])]);
    }

    /**
     * Deletes the agent corresponding to the given index in the list of agents.
     * @param agent_index {number}
     */
    delete_agent(name, aux_only=false){
        if (!Array.isArray(name)) {
            name = [name,];
        }   

        let num_found = 0;
        let updated_agents = [];
        let updated_game_obs = [];
        let updated_game_rewards = [];
        for(let i=0; i < this.agents.length; i++) {
            let agent = this.agents[i];

            let match = name.includes(agent.name);

            if (match) {
                num_found += 1
            }

            if (match && !(aux_only && num_found == 1)) {
                agent.agent_body.destroy(this.world);
            }
            else {
                updated_agents.push(agent);
                updated_game_obs.push(window.game.obs[i]);
                updated_game_rewards.push(window.game.rewards[i]);
            }
        }

        this.agents = updated_agents;

        for(let i = 0; i < this.agents.length; i++){
            this.agents[i].id = i;
        }
        // if(this.agents.length > 0 && agent_index < this.agents.length){

        //     // Removes the agent from the list and destroys its body
        //     let agent = this.agents[agent_index];
        //     this.agents.splice(agent_index, 1);
        //     agent.agent_body.destroy(this.world);

        //     // Adjusts the id of the other agents
        //     for(let i = 0; i < this.agents.length; i++){
        //         this.agents[i].id = i;
        //     }

        //     // Removes the observation of this agent from the list of observations.
        //     window.game.obs[window.game.obs.length - 1].splice(agent_index, 1);
        //     window.game.rewards[window.game.rewards.length - 1].splice(agent_index, 1);
        // }
    }

    delete_all_agents() {
        for (let i=0; i<this.agents.length; i++) {
            let agent = this.agents[i];
            agent.agent_body.destroy(this.world);

            window.game.obs[window.game.obs.length - 1] = [];
            window.game.rewards[window.game.rewards.length - 1] = [];
        }

        this.agents = []
    }

    /**
     * Creates a circle body at the given position and with the given radius.
     * @param pos {{x: number, y: number}}
     * @param radius {number}
     */
    create_circle_asset(pos, radius){
        // Computes the best y position corresponding to pos.x to always generate the assets between the ground and the ceiling
        let y_ground = find_best_y(pos.x, this.terrain_ground, radius);
        if(y_ground == null){
            y_ground = -Infinity;
        }
        let y_ceiling = find_best_y(pos.x, this.terrain_ceiling, radius);
        if(y_ceiling == null){
            y_ceiling = Infinity;
        }
        let y = Math.max(y_ground + radius, Math.min(y_ceiling - radius, pos.y));

        // Box2D creation
        this.fd_circle.shape.m_radius = radius;
        let body_def = new b2.BodyDef();
        body_def.type = b2.Body.b2_dynamicBody;
        body_def.position.Assign(new b2.Vec2(pos.x, y));
        let t = this.world.CreateBody(body_def);
        t.CreateFixture(this.fd_circle);
        t.SetUserData(new CustomUserData("circle", CustomUserDataObjectTypes.TERRAIN));
        let poly_data = {
            type : "circle",
            color1 : "#885C00", // [136, 92, 0];
            color2 : "#5F3D0E", // [95, 61, 14];
            body : t,
            is_selected: false
        }
        this.assets_bodies.push(poly_data);
    }

    /**
     * Sets the position of the given asset to the given position.
     * @param asset {Object}
     * @param pos {{x: number, y: number}}
     */
    set_asset_position(asset, pos){
        let shape = asset.body.GetFixtureList().GetShape();
        let radius;
        // Only supports circle assets for now
        if(shape.m_type == b2.Shape.e_circle){
            radius = shape.m_radius;
        }

        // Computes the best y position corresponding to pos.x to always generate the assets between the ground and the ceiling
        let y_ground = find_best_y(pos.x, this.terrain_ground, radius);
        if(y_ground == null){
            y_ground = -Infinity;
        }
        let y_ceiling = find_best_y(pos.x, this.terrain_ceiling, radius);
        if(y_ceiling == null){
            y_ceiling = Infinity;
        }
        let y = Math.max(y_ground + radius, Math.min(y_ceiling - radius, pos.y));
        asset.body.SetTransform(new b2.Vec2(pos.x, y),
                                asset.body.GetAngle());
        asset.body.SetLinearVelocity(new b2.Vec2(0, -0.1));
    }

    /**
     * Deletes the given asset.
     * @param asset {Object}
     */
    delete_asset(asset){
        if(this.assets_bodies.length > 0){
            let index = this.assets_bodies.indexOf(asset);
            if(index != -1){
                // Removes the asset from the list and destroys its body
                this.assets_bodies.splice(index, 1);
                this.world.DestroyBody(asset.body);
            }
        }
    }
    //endregion
}

/**
 * Finds the best y value corresponding to the given x value according to the points in the given array.
 * @param x {number}
 * @param array {Array}
 * @param [max_dist=null] {number} - Maximum horizontal distance to consider if no good y position has been found
 * @return {number}
 */
function find_best_y(x, array, max_dist=null){
    // Finds the closest point to x in array according to the x-coordinate
    let p1 = array.reduce(function(prev, curr) {
        return (Math.abs(curr.x - x) < Math.abs(prev.x - x) ? curr : prev);
    });

    // Gets the index of p1
    let i1 = array.indexOf(p1);

    // Gets p2 so that x in [p1.x, p2.x] or x in [p2.x, p1.x]
    let p2;

    // Case x > p1.x --> x in [p1.x, p2.x]
    if(x > p1.x){
        if(i1 < array.length - 1){
            p2 = array[i1 + 1];
        }
        else{
            p2 = p1;
        }
    }
    // Case x <= p1.x --> x in [p2.x, p1.x]
    else{
        if(i1 > 0){
            p2 = array[i1 - 1];
        }
        else{
            p2 = p1;
        }
    }

    let y = p1.y;
    // Computes the equation of the line between p1 and p2 and finds y corresponding to x
    if(p1.x != p2.x){
        let a = (p2.y - p1.y) / (p2.x - p1.x);
        let b = p1.y - a * p1.x;
        y = a * x + b;
    }

    // If p1 and p2 are the same point and x is too distant from it, returns null to indicate that no good point has been found
    else if(max_dist != null && Math.abs(x - p1.x) > max_dist){
            y = null;
    }
    return y;
}

/**
 * Smoothes the terrain by filtering points that are horizontally too close according to the given epsilon value.
 * @param terrain {Array} - Array of points
 * @param epsilon {number} - Minimal horizontal distance between two points
 * @return {Array} - Filtered array of points
 */
function smoothTerrainFiler(terrain, epsilon){
    let smooth_terrain = [];
    if(terrain.length > 0){
        smooth_terrain.push(terrain[0]);
        let n = 0;
        for(let i = 1; i < terrain.length - 1; i++){
            if(terrain[i].x >= smooth_terrain[n].x + epsilon){
                smooth_terrain.push(terrain[i]);
                n += 1;
            }
        }
        smooth_terrain.push(terrain[terrain.length - 1]);
    }
    return smooth_terrain;
};