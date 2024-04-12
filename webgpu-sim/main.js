/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 312:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const renderer_1 = __importDefault(__webpack_require__(862));
const canvas = document.getElementById('gfx');
const { width, height } = canvas.getBoundingClientRect();
canvas.width = width;
canvas.height = height;
const renderer = new renderer_1.default(canvas);
renderer.start();


/***/ }),

/***/ 862:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const blit_wgsl_1 = __importDefault(__webpack_require__(861));
const decay_wgsl_1 = __importDefault(__webpack_require__(535));
const agent_compute_wgsl_1 = __importDefault(__webpack_require__(600));
const unitSquareData = {
    vertices: new Float32Array([
        1.0, -1.0, 0.0,
        -1.0, -1.0, 0.0,
        -1.0, 1.0, 0.0,
        1.0, 1.0, 0.0, // TR
    ]),
    uvs: new Float32Array([
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0, // TR
    ]),
    indices: new Uint16Array([0, 1, 2, 2, 3, 0]),
};
const createBuffer = (device, arr, usage) => {
    // 📏 Align to 4 bytes (thanks @chrimsonite)
    let desc = {
        size: (arr.byteLength + 3) & ~3,
        usage,
        mappedAtCreation: true
    };
    let buffer = device.createBuffer(desc);
    const writeArray = arr instanceof Uint16Array
        ? new Uint16Array(buffer.getMappedRange())
        : new Float32Array(buffer.getMappedRange());
    writeArray.set(arr);
    buffer.unmap();
    return buffer;
};
const AGENT_FIELD_SIZE = 512;
const NUM_AGENTS = 512;
const AGENTS_PER_GROUP = 64; // TODO: Update compute shader if this changes
const NUM_GROUPS = Math.ceil(NUM_AGENTS / AGENTS_PER_GROUP);
class Renderer {
    constructor(canvas) {
        this.previousFrameTimestamp = 0;
        this.pingpong = 0;
        this.render = (time = 0) => {
            // Clamp deltaT at 17ms. Avoids huge jump if tab loses focus and then returns
            const deltaT = Math.min(17, (time - this.previousFrameTimestamp)) / 1000; // In seconds
            this.previousFrameTimestamp = time;
            // Update uniforms
            this.simParamValues.set([Math.random(), deltaT]);
            this.device.queue.writeBuffer(this.simParamBuffer, 0, this.simParamValues);
            // Write and submit commands to queue
            // TODO: Use a single encoder?
            // this.queue.submit([this.encodeDecayCommands(), this.encodeAgentComputeCommands(deltaT), this.encodeBlitCommands()]);
            const commandEncoder = this.device.createCommandEncoder();
            this.encodeDecayCommands(commandEncoder);
            this.encodeAgentComputeCommands(commandEncoder);
            this.encodeBlitCommands(commandEncoder);
            this.device.queue.submit([commandEncoder.finish()]);
            this.pingpong = this.pingpong ? 0 : 1;
            // Refresh canvas
            requestAnimationFrame(this.render);
        };
        this.canvas = canvas;
    }
    // Start the rendering engine
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.initializeAPI()) {
                this.resizeBackings();
                this.initializeSimParams();
                this.initializeBlitResources();
                this.initializeAgentResources();
                this.render();
            }
        });
    }
    // Initialize WebGPU
    initializeAPI() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🏭 Entry to WebGPU
                const entry = navigator.gpu;
                if (!entry) {
                    return false;
                }
                // 🔌 Physical Device Adapter
                this.adapter = yield entry.requestAdapter();
                // 💻 Logical Device
                this.device = yield this.adapter.requestDevice({
                    requiredFeatures: [
                        'float32-filterable',
                    ],
                });
                // 📦 Queue
                this.queue = this.device.queue;
            }
            catch (e) {
                console.error(e);
                return false;
            }
            return true;
        });
    }
    initializeSimParams() {
        // SimParams uniforms
        this.simParamValues = new Float32Array([Math.random(), 16.6 / 1000]);
        this.simParamBuffer = createBuffer(this.device, this.simParamValues, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.simParamsUniformLayout = this.device.createBindGroupLayout({
            label: 'AgentSimParams',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                        minBindingSize: 8,
                    },
                },
            ]
        });
        this.simParamBindGroup = this.device.createBindGroup({
            label: `SimParamUniforms`,
            layout: this.simParamsUniformLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.simParamBuffer },
                },
            ]
        });
    }
    initializeAgentResources() {
        // Create the agent buffers
        const floatsPerAgent = 4;
        const agentData = new Float32Array(NUM_AGENTS * floatsPerAgent);
        for (let i = 0; i < NUM_AGENTS; i += floatsPerAgent) {
            const angle = Math.random() * 2 * Math.PI;
            agentData[i + 0] = Math.random() * AGENT_FIELD_SIZE; // pos.x
            agentData[i + 1] = Math.random() * AGENT_FIELD_SIZE; // pos.y
            agentData[i + 2] = Math.sin(angle) * AGENT_FIELD_SIZE / 10.0; // vel.x
            agentData[i + 3] = Math.cos(angle) * AGENT_FIELD_SIZE / 10.0; // vel.y
        }
        this.agentBuffers = [
            { buffer: createBuffer(this.device, agentData, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE) },
            { buffer: createBuffer(this.device, agentData, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE) },
        ];
        // Shaders
        const decayModule = this.device.createShaderModule({
            code: decay_wgsl_1.default,
        });
        const computeModule = this.device.createShaderModule({
            code: agent_compute_wgsl_1.default,
        });
        // Graphics Pipeline
        // Input Assembly
        const positionAttribDesc = {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3'
        };
        const positionBufferDesc = {
            attributes: [positionAttribDesc],
            arrayStride: 4 * 3,
            stepMode: 'vertex'
        };
        const uvAttribDesc = {
            shaderLocation: 1,
            offset: 0,
            format: 'float32x2'
        };
        const uvBufferDesc = {
            attributes: [uvAttribDesc],
            arrayStride: 4 * 2,
            stepMode: 'vertex'
        };
        // Uniform Data
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'AgentFieldBindGroup',
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            ],
        });
        const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.simParamsUniformLayout, bindGroupLayout] });
        // Create field textures
        const baseFieldData = new Float32Array(AGENT_FIELD_SIZE * AGENT_FIELD_SIZE * 4);
        baseFieldData.fill(0);
        const fieldDescriptor = {
            label: 'AgentFieldTexture',
            size: [AGENT_FIELD_SIZE, AGENT_FIELD_SIZE, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
            format: 'rgba32float',
        };
        const sampler = this.device.createSampler();
        const createField = () => {
            const texture = this.device.createTexture(fieldDescriptor);
            const view = texture.createView();
            const bindGroup = this.device.createBindGroup({
                label: 'AgentFieldBindGroup',
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: view },
                ],
            });
            this.device.queue.writeTexture({ texture }, baseFieldData, { bytesPerRow: AGENT_FIELD_SIZE * 4 * 4 }, { width: AGENT_FIELD_SIZE, height: AGENT_FIELD_SIZE });
            return {
                texture,
                view,
                bindGroup,
            };
        };
        this.agentFieldTextures = [
            createField(),
            createField(),
        ];
        // Decay pipeline
        // Shader Stages
        const vertex = {
            module: decayModule,
            entryPoint: 'vs_main',
            buffers: [positionBufferDesc, uvBufferDesc]
        };
        const colorState = {
            format: 'rgba32float',
        };
        const fragment = {
            module: decayModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        };
        // Rasterization
        const primitive = {
            frontFace: 'cw',
            cullMode: 'none',
            topology: 'triangle-list'
        };
        const pipelineDesc = {
            label: 'DecayPipeline',
            layout: pipelineLayout,
            vertex,
            fragment,
            primitive,
        };
        this.agentFieldPipeline = this.device.createRenderPipeline(pipelineDesc);
        // Agent update pipeline
        const computeBindGroupLayout = this.device.createBindGroupLayout({
            label: 'AgentUpdate',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'read-only-storage',
                        minBindingSize: NUM_AGENTS * 4 * 4,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                        minBindingSize: NUM_AGENTS * 4 * 4,
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        format: 'rgba32float',
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'write-only',
                        format: 'rgba32float',
                        viewDimension: '2d',
                    },
                },
            ]
        });
        this.agentBindGroups = (new Array(2).fill(0)).map((_, i) => {
            const textureData = this.agentFieldTextures[i];
            const nextTextureData = this.agentFieldTextures[(i + 1) % 2];
            const agentData = this.agentBuffers[i];
            const nextAgentData = this.agentBuffers[(i + 1) % 2];
            return {
                bindGroup: this.device.createBindGroup({
                    label: `AgentCompute${i}`,
                    layout: computeBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: { buffer: agentData.buffer },
                        },
                        {
                            binding: 1,
                            resource: { buffer: nextAgentData.buffer },
                        },
                        {
                            binding: 2,
                            resource: textureData.view,
                        },
                        {
                            binding: 3,
                            resource: nextTextureData.view,
                        },
                    ],
                }),
            };
        });
        this.agentComputePipeline = this.device.createComputePipeline({
            label: 'AgentCompute',
            compute: {
                module: computeModule,
                entryPoint: 'compute_main',
            },
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.simParamsUniformLayout, computeBindGroupLayout] }),
        });
    }
    // Initialize resources to the final blit
    initializeBlitResources() {
        this.unitSquare = {
            positionBuffer: createBuffer(this.device, unitSquareData.vertices, GPUBufferUsage.VERTEX),
            uvBuffer: createBuffer(this.device, unitSquareData.uvs, GPUBufferUsage.VERTEX),
            indexBuffer: createBuffer(this.device, unitSquareData.indices, GPUBufferUsage.INDEX),
        };
        // Shaders
        this.blitModule = this.device.createShaderModule({
            code: blit_wgsl_1.default,
        });
        // Graphics Pipeline
        // Input Assembly
        const positionAttribDesc = {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3'
        };
        const positionBufferDesc = {
            attributes: [positionAttribDesc],
            arrayStride: 4 * 3,
            stepMode: 'vertex'
        };
        const uvAttribDesc = {
            shaderLocation: 1,
            offset: 0,
            format: 'float32x2'
        };
        const uvBufferDesc = {
            attributes: [uvAttribDesc],
            arrayStride: 4 * 2,
            stepMode: 'vertex'
        };
        // Uniform Data
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'BlitBindGroupLayout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            ],
        });
        const pipelineLayoutDesc = { bindGroupLayouts: [bindGroupLayout] };
        const pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDesc);
        // Shader Stages
        const vertex = {
            module: this.blitModule,
            entryPoint: 'vs_main',
            buffers: [positionBufferDesc, uvBufferDesc]
        };
        // Color/Blend State
        const colorState = {
            format: navigator.gpu.getPreferredCanvasFormat(),
        };
        const fragment = {
            module: this.blitModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        };
        // Rasterization
        const primitive = {
            frontFace: 'cw',
            cullMode: 'none',
            topology: 'triangle-list'
        };
        const pipelineDesc = {
            label: 'BlitPipeline',
            layout: pipelineLayout,
            vertex,
            fragment,
            primitive,
        };
        this.pipeline = this.device.createRenderPipeline(pipelineDesc);
    }
    // Resize swapchain, frame buffer attachments
    resizeBackings() {
        // ⛓️ Swapchain
        if (!this.context) {
            this.context = this.canvas.getContext('webgpu');
            const canvasConfig = {
                device: this.device,
                format: navigator.gpu.getPreferredCanvasFormat(),
                usage: GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_SRC,
                alphaMode: 'opaque'
            };
            this.context.configure(canvasConfig);
        }
    }
    encodeAgentComputeCommands(encoder) {
        const pass = encoder.beginComputePass({ label: 'AgentCompute' });
        pass.setPipeline(this.agentComputePipeline);
        pass.setBindGroup(0, this.simParamBindGroup);
        pass.setBindGroup(1, this.agentBindGroups[this.pingpong].bindGroup);
        pass.dispatchWorkgroups(NUM_GROUPS, 1, 1);
        pass.end();
    }
    // Encodes commands to fade out the agent field
    encodeDecayCommands(encoder) {
        // Encode drawing commands
        const pass = encoder.beginRenderPass({
            label: 'DecayPass',
            colorAttachments: [
                {
                    view: this.agentFieldTextures[(this.pingpong + 1) % 2].view,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }
            ],
        });
        pass.setPipeline(this.agentFieldPipeline);
        pass.setViewport(0, 0, AGENT_FIELD_SIZE, AGENT_FIELD_SIZE, 0, 1);
        pass.setScissorRect(0, 0, AGENT_FIELD_SIZE, AGENT_FIELD_SIZE);
        pass.setBindGroup(0, this.simParamBindGroup);
        pass.setBindGroup(1, this.agentFieldTextures[this.pingpong].bindGroup);
        pass.setVertexBuffer(0, this.unitSquare.positionBuffer);
        pass.setVertexBuffer(1, this.unitSquare.uvBuffer);
        pass.setIndexBuffer(this.unitSquare.indexBuffer, 'uint16');
        pass.drawIndexed(6, 1);
        pass.end();
    }
    // Encode commands for final screen draw
    encodeBlitCommands(encoder) {
        let colorAttachment = {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
        };
        const renderPassDesc = {
            label: 'BlitPass',
            colorAttachments: [colorAttachment],
        };
        // Encode drawing commands
        const passEncoder = encoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setViewport(0, 0, this.canvas.width, this.canvas.height, 0, 1);
        passEncoder.setScissorRect(0, 0, this.canvas.width, this.canvas.height);
        passEncoder.setBindGroup(0, this.agentFieldTextures[this.pingpong].bindGroup);
        passEncoder.setVertexBuffer(0, this.unitSquare.positionBuffer);
        passEncoder.setVertexBuffer(1, this.unitSquare.uvBuffer);
        passEncoder.setIndexBuffer(this.unitSquare.indexBuffer, 'uint16');
        passEncoder.drawIndexed(6, 1);
        passEncoder.end();
    }
}
exports["default"] = Renderer;


/***/ }),

/***/ 600:
/***/ ((module) => {

module.exports = "// Compute shader\n\nstruct Agent {\n    pos: vec2<f32>,\n    vel: vec2<f32>,\n};\n\nstruct SimParams {\n    randomSeed: f32,\n    deltaT: f32,\n};\n\nstruct ComputeIn {\n    @builtin(global_invocation_id) global_invocation_id: vec3<u32>,\n};\n\n@group(0) @binding(0) var<uniform> params : SimParams;\n@group(1) @binding(0) var<storage, read> agentsSrc : array<Agent>;\n@group(1) @binding(1) var<storage, read_write> agentsDst : array<Agent>;\n@group(1) @binding(2) var fieldSrc : texture_2d<f32>;\n@group(1) @binding(3) var fieldDst : texture_storage_2d<rgba32float, write>;\n\n// const PI: f32 = 3.14159274;\nconst TWO_PI: f32 = 6.28318548;\nconst AGENT_FIELD_SIZE: f32 = 512.0;\nconst AGENT_SPEED: f32 = AGENT_FIELD_SIZE / 10.0; // field units/second\nconst FIELD_MIN: vec2<f32> = vec2(0.0);\nconst FIELD_MAX: vec2<f32> = vec2(AGENT_FIELD_SIZE);\n\n// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83\nfn rand(n: f32) -> f32 {\n    return fract(sin(n + params.randomSeed) * 43758.5453123);\n}\n\nfn random_angle(in: f32) -> vec2<f32> {\n    let angle = rand(in) * TWO_PI;\n\n    return vec2<f32>(\n        cos(angle),\n        sin(angle),\n    ) * AGENT_SPEED;\n}\n\n@compute\n@workgroup_size(64)\nfn compute_main(in: ComputeIn) {\n    let total = arrayLength(&agentsSrc);\n    let index = in.global_invocation_id.x;\n    // TODO: What is this guarding against?\n    if index >= total {\n        return;\n    }\n\n    var vel = agentsSrc[index].vel;\n    var pos = agentsSrc[index].pos + vel * params.deltaT;\n\n    // // Keep particles in bounds\n    if pos.x < 0 || pos.x > AGENT_FIELD_SIZE || pos.y < 0 || pos.y > AGENT_FIELD_SIZE {\n        pos = clamp(pos, FIELD_MIN, FIELD_MAX); // Reset position and pick a new angle\n\n        // Random bounce angle\n        vel = random_angle(vel.x + vel.y + f32(in.global_invocation_id.x));\n        // vel = -vel;\n    }\n\n\n    // // Update agent\n    agentsDst[index] = Agent(pos, vel);\n\n    // Write data to field\n    // textureStore(fieldDst, vec2<u32>(12, 12), vec4<f32>(1.0));\n    textureStore(fieldDst, vec2<i32>(pos), vec4(1.0));\n}\n";

/***/ }),

/***/ 861:
/***/ ((module) => {

module.exports = "struct VertexInput {\n    @location(0) pos: vec3f,\n    @location(1) uv: vec2f,\n}\n\nstruct VertexOutput {\n    @builtin(position) pos: vec4f,\n    @location(0) uv: vec2f,\n };\n\n@vertex\nfn vs_main(in: VertexInput) -> VertexOutput {\n    var out: VertexOutput;\n\n    out.pos = vec4f(in.pos, 1);\n    out.uv = in.uv;\n\n    return out;\n}\n\n@group(0) @binding(0) var fieldSampler: sampler;\n@group(0) @binding(1) var fieldTexture: texture_2d<f32>;\n\n@fragment\nfn fs_main(in: VertexOutput) -> @location(0) vec4f {\n    return vec4(textureSample(fieldTexture, fieldSampler, in.uv).rgb, 1.0);\n}\n";

/***/ }),

/***/ 535:
/***/ ((module) => {

module.exports = "struct VertexInput {\n    @location(0) pos: vec3f,\n    @location(1) uv: vec2f,\n}\n\nstruct VertexOutput {\n    @builtin(position) pos: vec4f,\n    @location(0) uv: vec2f,\n };\n\n@vertex\nfn vs_main(in: VertexInput) -> VertexOutput {\n    var out: VertexOutput;\n\n    out.pos = vec4f(in.pos, 1);\n    out.uv = in.uv;\n\n    return out;\n}\n\nstruct SimParams {\n    randomSeed: f32,\n    deltaT: f32,\n};\n\n@group(0) @binding(0) var<uniform> params : SimParams;\n\n@group(1) @binding(0) var fieldSampler: sampler;\n@group(1) @binding(1) var fieldTexture: texture_2d<f32>;\n\nconst DECAY_RATE = 0.06; // units/second\n\n@fragment\nfn fs_main(in: VertexOutput) -> @location(0) vec4f {\n    var pixelStep = vec2(1.0) / vec2f(textureDimensions(fieldTexture));\n\n    var color_out = vec4f();\n\n    // Diffusion 3x3 blur\n    var sum = vec4f();\n    for (var i = -1; i <= 1; i++) {\n        for (var j = -1; j <= 1; j++) {\n            sum += textureSample(fieldTexture, fieldSampler, in.uv + pixelStep * vec2f(f32(i), f32(j)));\n        }\n    }\n    color_out += sum / 9.0;\n\n    // Decay\n    color_out = max(vec4(), color_out - vec4(DECAY_RATE) * params.deltaT);\n\n    return color_out;\n}\n";

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(312);
/******/ 	
/******/ })()
;