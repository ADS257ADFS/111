const params = new URLSearchParams(location.search);
let canvasId = params.get('id') || '';

/*
 * Modular boundaries — see docs/smart-canvas-architecture.md
 *   smart-canvas-providers.js   → API platform load
 *   smart-canvas-persistence.js → save / load / merge
 *   smart-canvas-history.js     → canvas list panel
 *   smart-canvas-composer.js      → composer panel shell
 *   smart-canvas-ui-bindings.js   → UI event bindings
 *   smart-canvas-generation.js    → run / poll / cancel
 *   smart-canvas-upload.js        → file upload + drag-drop import
 *   smart-canvas-nodes-render.js  → render(), node body HTML
 *   smart-canvas-node-events.js   → bindNodeEvents, port drag, prompt/loop controls
 *   smart-canvas-ui-context.js      → buildSmartCanvasUiContext (chrome/canvas ctx)
 *   smart-canvas.js (this file)   → composer params, cascade, assets, ctx bridge
 */

const shell = document.getElementById('shell');
const world = document.getElementById('world');
const composer = document.getElementById('composer');
const createMenu = document.getElementById('createMenu');
const promptInput = document.getElementById('promptInput');
const mentionPicker = document.getElementById('mentionPicker');
const mentionPreview = document.getElementById('mentionPreview');
const composerHeadParams = document.getElementById('composerHeadParams');
const dynamicParams = document.getElementById('dynamicParams');
const runBtn = document.getElementById('runBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const cascadeRunBtn = document.getElementById('cascadeRunBtn');
const canvasMainBtn = document.getElementById('canvasMainBtn');
const apiSettingsBtn = document.getElementById('apiSettingsBtn');
const fileInput = document.getElementById('fileInput');
const apiKindToggle = document.getElementById('apiKindToggle');
const inputThumbsRow = document.getElementById('inputThumbsRow');
const inputPromptPreview = document.getElementById('inputPromptPreview');
const minimap = document.getElementById('minimap');
const minimapContent = document.getElementById('minimapContent');
const canvasMinimapToggle = document.getElementById('canvasMinimapToggle');
const canvasFitViewBtn = document.getElementById('canvasFitViewBtn');
const canvasHelpBtn = document.getElementById('canvasHelpBtn');
const imageEditModal = document.getElementById('imageEditModal');
const smartLogModal = document.getElementById('smartLogModal');
const smartLogList = document.getElementById('smartLogList');
const smartShortcutModal = document.getElementById('smartShortcutModal');
const smartWorkflowToggle = document.getElementById('smartWorkflowToggle');
const smartWorkflowTransferModal = document.getElementById('smartWorkflowTransferModal');
const smartWorkflowTransferSub = document.getElementById('smartWorkflowTransferSub');
const smartWorkflowExportMeta = document.getElementById('smartWorkflowExportMeta');
const smartWorkflowImportInput = document.getElementById('smartWorkflowImportInput');
const smartWorkflowImportDropZone = document.getElementById('smartWorkflowImportDropZone');
const selectionBox = document.getElementById('selectionBox');
const selectionBoxCapsule = document.getElementById('selectionBoxCapsule');
const assetToggle = document.getElementById('assetToggle');
const newCanvasBtn = document.getElementById('newCanvasBtn');
const assetPanel = document.getElementById('assetPanel');
const assetCloseBtn = document.getElementById('assetCloseBtn');
const assetLibrarySelect = document.getElementById('assetLibrarySelect');
const assetCategorySelect = document.getElementById('assetCategorySelect');
const assetGrid = document.getElementById('assetGrid');
const assetPromptLibrary = document.getElementById('assetPromptLibrary');
const assetDropZone = document.getElementById('assetDropZone');
const assetImageControls = document.getElementById('assetImageControls');
const assetDialogBackdrop = document.getElementById('assetDialogBackdrop');
const assetDialogTitle = document.getElementById('assetDialogTitle');
const assetDialogInput = document.getElementById('assetDialogInput');
const assetDialogCancel = document.getElementById('assetDialogCancel');
const assetDialogOk = document.getElementById('assetDialogOk');
const assetHoverPreview = document.getElementById('assetHoverPreview');
const assetAddCategoryBtn = document.getElementById('assetAddCategoryBtn');
const assetRenameCategoryBtn = document.getElementById('assetRenameCategoryBtn');
const assetBreadcrumb = document.getElementById('assetBreadcrumb');
const ASSET_GRID_SIZE_KEY = 'smart_canvas_asset_grid_size_v1';
let assetGridSize = (() => {
    try {
        const saved = localStorage.getItem(ASSET_GRID_SIZE_KEY);
        return ['s', 'm', 'l'].includes(saved) ? saved : 'm';
    } catch(e) {
        return 'm';
    }
})();
const imageQuickToolbar = document.getElementById('imageQuickToolbar');
const imageHdPopover = document.getElementById('imageHdPopover');
const imageHdCancel = document.getElementById('imageHdCancel');
const imageHdApply = document.getElementById('imageHdApply');
const entryBounceTimers = new WeakMap();

const SMART_IMAGE_DROP_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;
const SMART_IMAGE_DROP_TEXT_TYPES = [
    'text/uri-list',
    'text/plain',
    'text/html',
    'DownloadURL',
    'text/x-moz-url',
    'text/x-file-url',
    'public.file-url',
    'public.url',
    'UniformResourceLocator',
    'FileName',
    'FileNameW'
];
const SMART_IMAGE_DROP_TYPE_HINT_RE = /^(?:files?|image\/.+|text\/(?:uri-list|html|plain|x-moz-url|x-file-url)|downloadurl|public\.(?:file-url|url)|uniformresourcelocator|filenamew?)$|application\/x-qt-(?:windows-mime|image)|application\/x-moz-file|com\.eagle/i;
const promptPresetPanel = document.getElementById('promptPresetPanel');
const promptPresetClose = document.getElementById('promptPresetClose');
const promptPresetStatus = document.getElementById('promptPresetStatus');
const promptPresetSelect = document.getElementById('promptPresetSelect');
const promptPresetName = document.getElementById('promptPresetName');
const promptPresetText = document.getElementById('promptPresetText');
const promptPresetApply = document.getElementById('promptPresetApply');
const promptPresetDelete = document.getElementById('promptPresetDelete');
const promptPresetNew = document.getElementById('promptPresetNew');
const promptPresetSave = document.getElementById('promptPresetSave');
const promptTemplatePanel = document.getElementById('promptTemplatePanel');
const promptTemplateClose = document.getElementById('promptTemplateClose');
const promptTemplateSearch = document.getElementById('promptTemplateSearch');
const promptTemplateLibrarySelect = document.getElementById('promptTemplateLibrarySelect');
const promptTemplateCats = document.getElementById('promptTemplateCats');
const promptTemplateBody = document.getElementById('promptTemplateBody');
const composerTemplateBtn = document.getElementById('composerTemplateBtn');
const canvasEmptyHint = document.getElementById('canvasEmptyHint');
const emptyHintDoubleBtn = document.getElementById('emptyHintDouble');
let canvasHydrated = false;
let canvasSyncInFlight = false;
const smartClientId = `canvas_smart_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
let minimapViewport = document.getElementById('minimapViewport');
let canvas = null;
let nodes = [];
let selectedId = '';
let selectedIds = [];
let selectedImage = {nodeId:'', index:-1};
let dragState = null;
let dragPending = null;
let loopInsertPreview = null;
let selectionState = null;
let selectionJustFinished = false;
let selectionMarqueeActive = false;
let smartGroupCapsuleOnly = false;
let resizeState = null;
let promptSplitResizeState = null;
let thumbDragState = null;
let uploadTargetId = '';
let pendingGroupUploadPoint = null;
let mentionRange = null;
let panState = null;
let didPan = false;
let viewportAnimFrame = 0;
let viewportAnimToken = 0;
let portDragState = null;
let saveTimer = null;
let apiProviders = [];
let comfyWorkflows = [];
let runningHubWorkflowCache = {};
let comfyInstanceCount = 1;
let assetLibrary = {categories:[]};
let assetLibraryOpen = false;
let assetTab = 'image';
let activeAssetCategoryId = '';
const LOCAL_ASSET_LIBRARY_ID = '__local_assets__';
const ASSET_SMART_CATEGORY_PREFIX = '__smart_class__::';
let activeAssetLibraryId = '';
let mentionSource = 'input';
let mentionAssetCategoryId = '';
let assetLibraryUpdatedAt = 0;
let assetLibraryRefreshTimer = null;
const PROMPT_PRESETS_KEY = 'smart_canvas_prompt_presets_v1';
const PROMPT_TEMPLATE_GROUPS_KEY = 'smart_canvas_prompt_template_groups_v1';
const PROMPT_TEMPLATE_OVERRIDES_KEY = 'smart_canvas_prompt_template_overrides_v1';
let promptPresets = [];
let builtinPromptTemplates = [];
let promptLibraries = [];
let activePromptLibraryId = 'system';
let promptTemplateGroups = [];
let promptTemplateOverrides = {hiddenBuiltinIds:[], editedBuiltins:{}};
let promptTemplateCategory = 'all';
let promptTemplateSelectedId = '';
let promptTemplateEditing = false;
let promptTemplateGroupEditMode = false;
let promptPresetDeleteArmed = false;
let createMenuPoint = {x:0, y:0};
let lastComposerNodeId = '';
let activeComposerSubject = null;
let nodeClipboard = null;
let imageClickTimer = null;
let suppressImageClickUntil = 0;
let lastMouseWorld = null;
let lastConfigRefreshAt = 0;
let smartMinimapState = null;
let smartMinimapDrag = false;
let zoomPreviewState = null;
let runTimerInterval = null;
let composerHdScale = 1;
let smartCascadeRunning = false;
let smartCascadeActiveLoopId = '';
let smartCascadeStopRequested = false;
let smartCascadeSilentSelection = false;
let smartCascadeRunPath = null;
const smartCascadeRuns = new Map();
let smartLoopContext = null;
let transientSmartCloudLinks = [];
let runBtnCooldownToken = 0;
let smartRunStateToken = 0;
const smartNodeRunTokens = new Map();
let smartRhRandomValues = {};
let lastImagePasteAt = 0;
let lastNodePasteAt = 0;
let suppressNodeClickUntil = 0;
let textSelectionGuard = null;
const UNDO_LIMIT = 40;
const undoStack = [];
let undoSuppressed = false;
let pendingUndoSnapshot = null;
function activeSmartCascadeCount(){ return window.SmartCanvasCascade?.activeSmartCascadeCount?.(); }
function smartCascadeRunForLoop(loopId){ return window.SmartCanvasCascade?.smartCascadeRunForLoop?.(loopId); }
function smartCascadeIsLoopRunning(loopId){ return window.SmartCanvasCascade?.smartCascadeIsLoopRunning?.(loopId); }
function syncSmartCascadeLegacyState(preferredLoopId=''){ return window.SmartCanvasCascade?.syncSmartCascadeLegacyState?.(preferredLoopId); }
function smartCascadeAnyRunning(){ return window.SmartCanvasCascade?.smartCascadeAnyRunning?.(); }
function smartCascadeEdgeState(edgeKey){ return window.SmartCanvasCascade?.smartCascadeEdgeState?.(edgeKey); }
function smartCascadePathForCtx(ctx=null){ return window.SmartCanvasCascade?.smartCascadePathForCtx?.(ctx); }
function capturePendingUndo(){ return window.SmartCanvasUndo?.capturePendingUndo?.(); }
function commitPendingUndo(){ return window.SmartCanvasUndo?.commitPendingUndo?.(); }
function discardPendingUndo(){ return window.SmartCanvasUndo?.discardPendingUndo?.(); }
function snapshotForUndo(){ return window.SmartCanvasUndo?.snapshotForUndo?.(); }
function pushUndo(){ return window.SmartCanvasUndo?.pushUndo?.(); }
function performUndo(){ return window.SmartCanvasUndo?.performUndo?.(); }
let comfyWorkflowCache = {};
let cropState = null;
let cropDrag = null;
let imageEditMode = 'crop';
let imageEditModeTouched = false;
let editDrawState = null;
let editTextItems = [];
let editTextSelectedId = '';
let editTextDrag = null;
let editTextDirty = false;
let editTextInlineEditor = null;
let editDrawUndoStack = [];
let editDrawRedoStack = [];
const EDIT_DRAW_HISTORY_MAX = 40;
let brushTool = 'free';
let brushLabelCounter = 1;
let gridCustomMode = false;
let gridCustomLines = [];
let gridCustomOrientation = 'h';
let gridCustomHistory = [];
let gridCustomDrag = null;
let cutoutSelectionMask = null;
let cutoutSourceImageData = null;
let cutoutLastSeed = null;
let cutoutHistory = [];
let cutoutLastAction = null;
let imageEditZoom = 1.0;
let imageEditBaseW = 0;
let imageEditBaseH = 0;
let previewZoom = 1.0;
let previewPan = {x:0, y:0};
let previewPanDrag = null;
let previewCompareDrag = false;
let previewComparePos = 50;
let imageEditPanDrag = null;
let previewNavState = {nodeId:'', index:0, count:0};
const PANORAMA_RATIO_PRESETS = {
    square:{w:1, h:1},
    portrait:{w:2, h:3},
    landscape:{w:3, h:2},
    portrait43:{w:3, h:4},
    landscape43:{w:4, h:3},
    story:{w:9, h:16},
    wide:{w:16, h:9},
    ultrawide:{w:21, h:9},
    ultratall:{w:9, h:21}
};
let panoramaState = {
    enabled:false,
    ratio:'wide',
    customW:16,
    customH:9,
    fov:75,
    yaw:0,
    pitch:0,
    drag:null,
    three:null,
    renderer:null,
    scene:null,
    camera:null,
    sphere:null,
    texture:null,
    threeLoadPromise:null,
    image:null,
    ctx:null,
    animationId:0,
    loadedSrc:'',
    loadToken:0
};
window.__smartCanvasPanoramaState = panoramaState;
let viewport = {x:0, y:0, scale:1};
let settings = {
    engine:'api',
    apiKind:'image',
    provider_id:'',
    model:'',
    ratio:'source',
    resolution:'1k',
    customRatio:'',
    customRatioWidth:'',
    customRatioHeight:'',
    customSize:'',
    customWidth:'',
    customHeight:'',
    quality:'low',
    count:1,
    videoProvider:'',
    videoModel:'',
    videoDuration:5,
    videoAspect:'16:9',
    videoResolution:'',
    videoCount:1,
    videoReferenceMode:'',
    msRatio:'square',
    msResolution:'1k',
    msCustomRatio:'',
    msCustomRatioWidth:'',
    msCustomRatioHeight:'',
    msCustomSize:'',
    msCustomWidth:'',
    msCustomHeight:'',
    comfyMode:'text',
    comfyWorkflow:'',
    comfyParams:{},
    width:1024,
    height:1024,
    enhanceStrength:0.5,
    enhanceUpscale:false,
    enhanceUpscaleRes:2048,
    editUpscale:false,
    editUpscaleRes:2048,
    promptH:124,
    msgenModel:'zimage',
    msCustomModel:'',
    rhConfigKey:'',
    rhPayment:'free',
    rhInstanceType:'',
    rhParams:{},
    rhRandomActive:{}
};
const SMART_REFERENCE_IMAGE_MAX = 20;
const MS_GEN_MODELS = {
    zimage: { label:'ZImage', modelId:'Tongyi-MAI/Z-Image-Turbo', supportsImage:false, endpoint:'/generate' },
    qwen_edit: { label:'Qwen Edit', modelId:'Qwen/Qwen-Image-Edit-2511', supportsImage:true, endpoint:'/api/angle/generate' },
    klein_edit: { label:'Klein', modelId:'black-forest-labs/FLUX.2-klein-9B', supportsImage:true, endpoint:'/api/ms/generate' },
    custom: { label:tr('smart.custom') || '自定义', modelId:'', acceptsImage:true, endpoint:'/api/ms/generate' }
};
const SIZE_MAP = {
    square: {'1k':'1024x1024','2k':'2048x2048','4k':'2880x2880'},
    landscape: {'1k':'1536x1024','2k':'2048x1360','4k':'3520x2336'},
    portrait: {'1k':'1024x1536','2k':'1360x2048','4k':'2336x3520'},
    landscape43: {'1k':'1024x768','2k':'2048x1536','4k':'3312x2480'},
    portrait43: {'1k':'768x1024','2k':'1536x2048','4k':'2480x3312'},
    wide: {'1k':'1536x864','2k':'2048x1152','4k':'3840x2160'},
    story: {'1k':'864x1536','2k':'1152x2048','4k':'2160x3840'},
    ultrawide: {'1k':'1536x656','2k':'2048x880','4k':'3840x1648'},
    ultratall: {'1k':'656x1536','2k':'880x2048','4k':'1648x3840'}
};
const RES_LONG_SIDE = { '1k':1024, '2k':2048, '4k':3840 };
const RES_PIXEL_LIMIT = { '1k':2359296, '2k':4194304, '4k':8294400 };
function tr(key){ return window.SmartCanvasUiFeedback?.tr?.(key); }
function trf(key, values={}){ return window.SmartCanvasUiFeedback?.trf?.(key, values); }
function refreshIcons(root=document){ return window.SmartCanvasUiFeedback?.refreshIcons?.(root); }
function updateCanvasEmptyHint(){ return window.SmartCanvasCanvasHint?.updateCanvasEmptyHint?.(); }
/* === D1b: buildSmartCanvasUiContext → smart-canvas-ui-context.js === */
let _smartCanvasContextScope = null;
function getSmartCanvasContextScope(){
    if(_smartCanvasContextScope) return _smartCanvasContextScope;
    const scope = {};
    Object.defineProperty(scope, 'canvasId', { get(){ return canvasId; }, set(v){ canvasId = v; }, enumerable: true });
    Object.defineProperty(scope, 'canvasHydrated', { get(){ return canvasHydrated; }, set(v){ canvasHydrated = v; }, enumerable: true });
    Object.defineProperty(scope, 'canvasSyncInFlight', { get(){ return canvasSyncInFlight; }, set(v){ canvasSyncInFlight = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartClientId', { get(){ return smartClientId; }, enumerable: true });
    Object.defineProperty(scope, 'minimapViewport', { get(){ return minimapViewport; }, set(v){ minimapViewport = v; }, enumerable: true });
    Object.defineProperty(scope, 'canvas', { get(){ return canvas; }, set(v){ canvas = v; }, enumerable: true });
    Object.defineProperty(scope, 'nodes', { get(){ return nodes; }, set(v){ nodes = v; }, enumerable: true });
    Object.defineProperty(scope, 'selectedId', { get(){ return selectedId; }, set(v){ selectedId = v; }, enumerable: true });
    Object.defineProperty(scope, 'selectedIds', { get(){ return selectedIds; }, set(v){ selectedIds = v; }, enumerable: true });
    Object.defineProperty(scope, 'selectedImage', { get(){ return selectedImage; }, set(v){ selectedImage = v; }, enumerable: true });
    Object.defineProperty(scope, 'dragState', { get(){ return dragState; }, set(v){ dragState = v; }, enumerable: true });
    Object.defineProperty(scope, 'dragPending', { get(){ return dragPending; }, set(v){ dragPending = v; }, enumerable: true });
    Object.defineProperty(scope, 'loopInsertPreview', { get(){ return loopInsertPreview; }, set(v){ loopInsertPreview = v; }, enumerable: true });
    Object.defineProperty(scope, 'selectionState', { get(){ return selectionState; }, set(v){ selectionState = v; }, enumerable: true });
    Object.defineProperty(scope, 'selectionJustFinished', { get(){ return selectionJustFinished; }, set(v){ selectionJustFinished = v; }, enumerable: true });
    Object.defineProperty(scope, 'resizeState', { get(){ return resizeState; }, set(v){ resizeState = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptSplitResizeState', { get(){ return promptSplitResizeState; }, set(v){ promptSplitResizeState = v; }, enumerable: true });
    Object.defineProperty(scope, 'thumbDragState', { get(){ return thumbDragState; }, set(v){ thumbDragState = v; }, enumerable: true });
    Object.defineProperty(scope, 'uploadTargetId', { get(){ return uploadTargetId; }, set(v){ uploadTargetId = v; }, enumerable: true });
    Object.defineProperty(scope, 'pendingGroupUploadPoint', { get(){ return pendingGroupUploadPoint; }, set(v){ pendingGroupUploadPoint = v; }, enumerable: true });
    Object.defineProperty(scope, 'mentionRange', { get(){ return mentionRange; }, set(v){ mentionRange = v; }, enumerable: true });
    Object.defineProperty(scope, 'panState', { get(){ return panState; }, set(v){ panState = v; }, enumerable: true });
    Object.defineProperty(scope, 'didPan', { get(){ return didPan; }, set(v){ didPan = v; }, enumerable: true });
    Object.defineProperty(scope, 'viewportAnimFrame', { get(){ return viewportAnimFrame; }, set(v){ viewportAnimFrame = v; }, enumerable: true });
    Object.defineProperty(scope, 'viewportAnimToken', { get(){ return viewportAnimToken; }, set(v){ viewportAnimToken = v; }, enumerable: true });
    Object.defineProperty(scope, 'portDragState', { get(){ return portDragState; }, set(v){ portDragState = v; }, enumerable: true });
    Object.defineProperty(scope, 'saveTimer', { get(){ return saveTimer; }, set(v){ saveTimer = v; }, enumerable: true });
    Object.defineProperty(scope, 'apiProviders', { get(){ return apiProviders; }, set(v){ apiProviders = v; }, enumerable: true });
    Object.defineProperty(scope, 'comfyWorkflows', { get(){ return comfyWorkflows; }, set(v){ comfyWorkflows = v; }, enumerable: true });
    Object.defineProperty(scope, 'runningHubWorkflowCache', { get(){ return runningHubWorkflowCache; }, set(v){ runningHubWorkflowCache = v; }, enumerable: true });
    Object.defineProperty(scope, 'comfyInstanceCount', { get(){ return comfyInstanceCount; }, set(v){ comfyInstanceCount = v; }, enumerable: true });
    Object.defineProperty(scope, 'assetLibrary', { get(){ return assetLibrary; }, set(v){ assetLibrary = v; }, enumerable: true });
    Object.defineProperty(scope, 'assetLibraryOpen', { get(){ return assetLibraryOpen; }, set(v){ assetLibraryOpen = v; }, enumerable: true });
    Object.defineProperty(scope, 'assetTab', { get(){ return assetTab; }, set(v){ assetTab = v; }, enumerable: true });
    Object.defineProperty(scope, 'activeAssetCategoryId', { get(){ return activeAssetCategoryId; }, set(v){ activeAssetCategoryId = v; }, enumerable: true });
    Object.defineProperty(scope, 'activeAssetLibraryId', { get(){ return activeAssetLibraryId; }, set(v){ activeAssetLibraryId = v; }, enumerable: true });
    Object.defineProperty(scope, 'mentionSource', { get(){ return mentionSource; }, set(v){ mentionSource = v; }, enumerable: true });
    Object.defineProperty(scope, 'mentionAssetCategoryId', { get(){ return mentionAssetCategoryId; }, set(v){ mentionAssetCategoryId = v; }, enumerable: true });
    Object.defineProperty(scope, 'assetLibraryUpdatedAt', { get(){ return assetLibraryUpdatedAt; }, set(v){ assetLibraryUpdatedAt = v; }, enumerable: true });
    Object.defineProperty(scope, 'assetLibraryRefreshTimer', { get(){ return assetLibraryRefreshTimer; }, set(v){ assetLibraryRefreshTimer = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresets', { get(){ return promptPresets; }, set(v){ promptPresets = v; }, enumerable: true });
    Object.defineProperty(scope, 'builtinPromptTemplates', { get(){ return builtinPromptTemplates; }, set(v){ builtinPromptTemplates = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptLibraries', { get(){ return promptLibraries; }, set(v){ promptLibraries = v; }, enumerable: true });
    Object.defineProperty(scope, 'activePromptLibraryId', { get(){ return activePromptLibraryId; }, set(v){ activePromptLibraryId = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateGroups', { get(){ return promptTemplateGroups; }, set(v){ promptTemplateGroups = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateOverrides', { get(){ return promptTemplateOverrides; }, set(v){ promptTemplateOverrides = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateCategory', { get(){ return promptTemplateCategory; }, set(v){ promptTemplateCategory = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateSelectedId', { get(){ return promptTemplateSelectedId; }, set(v){ promptTemplateSelectedId = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateEditing', { get(){ return promptTemplateEditing; }, set(v){ promptTemplateEditing = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateGroupEditMode', { get(){ return promptTemplateGroupEditMode; }, set(v){ promptTemplateGroupEditMode = v; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetDeleteArmed', { get(){ return promptPresetDeleteArmed; }, set(v){ promptPresetDeleteArmed = v; }, enumerable: true });
    Object.defineProperty(scope, 'createMenuPoint', { get(){ return createMenuPoint; }, set(v){ createMenuPoint = v; }, enumerable: true });
    Object.defineProperty(scope, 'nodeClipboard', { get(){ return nodeClipboard; }, set(v){ nodeClipboard = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageClickTimer', { get(){ return imageClickTimer; }, set(v){ imageClickTimer = v; }, enumerable: true });
    Object.defineProperty(scope, 'suppressImageClickUntil', { get(){ return suppressImageClickUntil; }, set(v){ suppressImageClickUntil = v; }, enumerable: true });
    Object.defineProperty(scope, 'lastMouseWorld', { get(){ return lastMouseWorld; }, set(v){ lastMouseWorld = v; }, enumerable: true });
    Object.defineProperty(scope, 'lastConfigRefreshAt', { get(){ return lastConfigRefreshAt; }, set(v){ lastConfigRefreshAt = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartMinimapState', { get(){ return smartMinimapState; }, set(v){ smartMinimapState = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartMinimapDrag', { get(){ return smartMinimapDrag; }, set(v){ smartMinimapDrag = v; }, enumerable: true });
    Object.defineProperty(scope, 'zoomPreviewState', { get(){ return zoomPreviewState; }, set(v){ zoomPreviewState = v; }, enumerable: true });
    Object.defineProperty(scope, 'runTimerInterval', { get(){ return runTimerInterval; }, set(v){ runTimerInterval = v; }, enumerable: true });
    Object.defineProperty(scope, 'composerHdScale', { get(){ return composerHdScale; }, set(v){ composerHdScale = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartCascadeRunning', { get(){ return smartCascadeRunning; }, set(v){ smartCascadeRunning = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartCascadeActiveLoopId', { get(){ return smartCascadeActiveLoopId; }, set(v){ smartCascadeActiveLoopId = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartCascadeStopRequested', { get(){ return smartCascadeStopRequested; }, set(v){ smartCascadeStopRequested = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartCascadeSilentSelection', { get(){ return smartCascadeSilentSelection; }, set(v){ smartCascadeSilentSelection = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartCascadeRunPath', { get(){ return smartCascadeRunPath; }, set(v){ smartCascadeRunPath = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartLoopContext', { get(){ return smartLoopContext; }, set(v){ smartLoopContext = v; }, enumerable: true });
    Object.defineProperty(scope, 'runBtnCooldownToken', { get(){ return runBtnCooldownToken; }, set(v){ runBtnCooldownToken = v; }, enumerable: true });
    Object.defineProperty(scope, 'smartRunStateToken', { get(){ return smartRunStateToken; }, set(v){ smartRunStateToken = v; }, enumerable: true });
    Object.defineProperty(scope, 'lastImagePasteAt', { get(){ return lastImagePasteAt; }, set(v){ lastImagePasteAt = v; }, enumerable: true });
    Object.defineProperty(scope, 'lastNodePasteAt', { get(){ return lastNodePasteAt; }, set(v){ lastNodePasteAt = v; }, enumerable: true });
    Object.defineProperty(scope, 'suppressNodeClickUntil', { get(){ return suppressNodeClickUntil; }, set(v){ suppressNodeClickUntil = v; }, enumerable: true });
    Object.defineProperty(scope, 'textSelectionGuard', { get(){ return textSelectionGuard; }, set(v){ textSelectionGuard = v; }, enumerable: true });
    Object.defineProperty(scope, 'undoSuppressed', { get(){ return undoSuppressed; }, set(v){ undoSuppressed = v; }, enumerable: true });
    Object.defineProperty(scope, 'pendingUndoSnapshot', { get(){ return pendingUndoSnapshot; }, set(v){ pendingUndoSnapshot = v; }, enumerable: true });
    Object.defineProperty(scope, 'comfyWorkflowCache', { get(){ return comfyWorkflowCache; }, set(v){ comfyWorkflowCache = v; }, enumerable: true });
    Object.defineProperty(scope, 'cropState', { get(){ return cropState; }, set(v){ cropState = v; }, enumerable: true });
    Object.defineProperty(scope, 'cropDrag', { get(){ return cropDrag; }, set(v){ cropDrag = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageEditMode', { get(){ return imageEditMode; }, set(v){ imageEditMode = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageEditModeTouched', { get(){ return imageEditModeTouched; }, set(v){ imageEditModeTouched = v; }, enumerable: true });
    Object.defineProperty(scope, 'editDrawState', { get(){ return editDrawState; }, set(v){ editDrawState = v; }, enumerable: true });
    Object.defineProperty(scope, 'editTextItems', { get(){ return editTextItems; }, set(v){ editTextItems = v; }, enumerable: true });
    Object.defineProperty(scope, 'editTextSelectedId', { get(){ return editTextSelectedId; }, set(v){ editTextSelectedId = v; }, enumerable: true });
    Object.defineProperty(scope, 'editTextDrag', { get(){ return editTextDrag; }, set(v){ editTextDrag = v; }, enumerable: true });
    Object.defineProperty(scope, 'editTextDirty', { get(){ return editTextDirty; }, set(v){ editTextDirty = v; }, enumerable: true });
    Object.defineProperty(scope, 'editTextInlineEditor', { get(){ return editTextInlineEditor; }, set(v){ editTextInlineEditor = v; }, enumerable: true });
    Object.defineProperty(scope, 'editDrawUndoStack', { get(){ return editDrawUndoStack; }, set(v){ editDrawUndoStack = v; }, enumerable: true });
    Object.defineProperty(scope, 'editDrawRedoStack', { get(){ return editDrawRedoStack; }, set(v){ editDrawRedoStack = v; }, enumerable: true });
    Object.defineProperty(scope, 'brushTool', { get(){ return brushTool; }, set(v){ brushTool = v; }, enumerable: true });
    Object.defineProperty(scope, 'brushLabelCounter', { get(){ return brushLabelCounter; }, set(v){ brushLabelCounter = v; }, enumerable: true });
    Object.defineProperty(scope, 'gridCustomMode', { get(){ return gridCustomMode; }, set(v){ gridCustomMode = v; }, enumerable: true });
    Object.defineProperty(scope, 'gridCustomLines', { get(){ return gridCustomLines; }, set(v){ gridCustomLines = v; }, enumerable: true });
    Object.defineProperty(scope, 'gridCustomOrientation', { get(){ return gridCustomOrientation; }, set(v){ gridCustomOrientation = v; }, enumerable: true });
    Object.defineProperty(scope, 'gridCustomHistory', { get(){ return gridCustomHistory; }, set(v){ gridCustomHistory = v; }, enumerable: true });
    Object.defineProperty(scope, 'gridCustomDrag', { get(){ return gridCustomDrag; }, set(v){ gridCustomDrag = v; }, enumerable: true });
    Object.defineProperty(scope, 'cutoutSelectionMask', { get(){ return cutoutSelectionMask; }, set(v){ cutoutSelectionMask = v; }, enumerable: true });
    Object.defineProperty(scope, 'cutoutSourceImageData', { get(){ return cutoutSourceImageData; }, set(v){ cutoutSourceImageData = v; }, enumerable: true });
    Object.defineProperty(scope, 'cutoutLastSeed', { get(){ return cutoutLastSeed; }, set(v){ cutoutLastSeed = v; }, enumerable: true });
    Object.defineProperty(scope, 'cutoutHistory', { get(){ return cutoutHistory; }, set(v){ cutoutHistory = v; }, enumerable: true });
    Object.defineProperty(scope, 'cutoutLastAction', { get(){ return cutoutLastAction; }, set(v){ cutoutLastAction = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageEditZoom', { get(){ return imageEditZoom; }, set(v){ imageEditZoom = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageEditBaseW', { get(){ return imageEditBaseW; }, set(v){ imageEditBaseW = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageEditBaseH', { get(){ return imageEditBaseH; }, set(v){ imageEditBaseH = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewZoom', { get(){ return previewZoom; }, set(v){ previewZoom = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewPan', { get(){ return previewPan; }, set(v){ previewPan = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewPanDrag', { get(){ return previewPanDrag; }, set(v){ previewPanDrag = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewCompareDrag', { get(){ return previewCompareDrag; }, set(v){ previewCompareDrag = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewComparePos', { get(){ return previewComparePos; }, set(v){ previewComparePos = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageEditPanDrag', { get(){ return imageEditPanDrag; }, set(v){ imageEditPanDrag = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewNavState', { get(){ return previewNavState; }, set(v){ previewNavState = v; }, enumerable: true });
    Object.defineProperty(scope, 'panoramaState', { get(){ return panoramaState; }, set(v){ panoramaState = v; }, enumerable: true });
    Object.defineProperty(scope, 'viewport', { get(){ return viewport; }, set(v){ viewport = v; }, enumerable: true });
    Object.defineProperty(scope, 'settings', { get(){ return settings; }, set(v){ settings = v; }, enumerable: true });
    Object.defineProperty(scope, 'canvasDefaultSmartSettings', { get(){ return canvasDefaultSmartSettings; }, set(v){ canvasDefaultSmartSettings = v; }, enumerable: true });
    Object.defineProperty(scope, 'recentSmartSettingsByMode', { get(){ return recentSmartSettingsByMode; }, set(v){ recentSmartSettingsByMode = v; }, enumerable: true });
    Object.defineProperty(scope, 'imageDblClickState', { get(){ return imageDblClickState; }, set(v){ imageDblClickState = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewCompareOn', { get(){ return previewCompareOn; }, set(v){ previewCompareOn = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewCompareIndex', { get(){ return previewCompareIndex; }, set(v){ previewCompareIndex = v; }, enumerable: true });
    Object.defineProperty(scope, 'previewMetaExtraText', { get(){ return previewMetaExtraText; }, set(v){ previewMetaExtraText = v; }, enumerable: true });
    Object.defineProperty(scope, 'lastComposerNodeId', { get(){ return lastComposerNodeId; }, set(v){ lastComposerNodeId = v; }, enumerable: true });
    Object.defineProperty(scope, 'activeComposerSubject', { get(){ return activeComposerSubject; }, set(v){ activeComposerSubject = v; }, enumerable: true });
    Object.defineProperty(scope, 'params', { get(){ return params; }, enumerable: true });
    Object.defineProperty(scope, 'shell', { get(){ return shell; }, enumerable: true });
    Object.defineProperty(scope, 'world', { get(){ return world; }, enumerable: true });
    Object.defineProperty(scope, 'composer', { get(){ return composer; }, enumerable: true });
    Object.defineProperty(scope, 'createMenu', { get(){ return createMenu; }, enumerable: true });
    Object.defineProperty(scope, 'promptInput', { get(){ return promptInput; }, enumerable: true });
    Object.defineProperty(scope, 'mentionPicker', { get(){ return mentionPicker; }, enumerable: true });
    Object.defineProperty(scope, 'mentionPreview', { get(){ return mentionPreview; }, enumerable: true });
    Object.defineProperty(scope, 'composerHeadParams', { get(){ return composerHeadParams; }, enumerable: true });
    Object.defineProperty(scope, 'dynamicParams', { get(){ return dynamicParams; }, enumerable: true });
    Object.defineProperty(scope, 'runBtn', { get(){ return runBtn; }, enumerable: true });
    Object.defineProperty(scope, 'regenerateBtn', { get(){ return regenerateBtn; }, enumerable: true });
    Object.defineProperty(scope, 'cascadeRunBtn', { get(){ return cascadeRunBtn; }, enumerable: true });
    Object.defineProperty(scope, 'canvasMainBtn', { get(){ return canvasMainBtn; }, enumerable: true });
    Object.defineProperty(scope, 'apiSettingsBtn', { get(){ return apiSettingsBtn; }, enumerable: true });
    Object.defineProperty(scope, 'fileInput', { get(){ return fileInput; }, enumerable: true });
    Object.defineProperty(scope, 'apiKindToggle', { get(){ return apiKindToggle; }, enumerable: true });
    Object.defineProperty(scope, 'inputThumbsRow', { get(){ return inputThumbsRow; }, enumerable: true });
    Object.defineProperty(scope, 'inputPromptPreview', { get(){ return inputPromptPreview; }, enumerable: true });
    Object.defineProperty(scope, 'minimap', { get(){ return minimap; }, enumerable: true });
    Object.defineProperty(scope, 'minimapContent', { get(){ return minimapContent; }, enumerable: true });
    Object.defineProperty(scope, 'canvasMinimapToggle', { get(){ return canvasMinimapToggle; }, enumerable: true });
    Object.defineProperty(scope, 'canvasFitViewBtn', { get(){ return canvasFitViewBtn; }, enumerable: true });
    Object.defineProperty(scope, 'canvasHelpBtn', { get(){ return canvasHelpBtn; }, enumerable: true });
    Object.defineProperty(scope, 'imageEditModal', { get(){ return imageEditModal; }, enumerable: true });
    Object.defineProperty(scope, 'smartLogModal', { get(){ return smartLogModal; }, enumerable: true });
    Object.defineProperty(scope, 'smartLogList', { get(){ return smartLogList; }, enumerable: true });
    Object.defineProperty(scope, 'smartShortcutModal', { get(){ return smartShortcutModal; }, enumerable: true });
    Object.defineProperty(scope, 'selectionBox', { get(){ return selectionBox; }, enumerable: true });
    Object.defineProperty(scope, 'assetToggle', { get(){ return assetToggle; }, enumerable: true });
    Object.defineProperty(scope, 'newCanvasBtn', { get(){ return newCanvasBtn; }, enumerable: true });
    Object.defineProperty(scope, 'assetPanel', { get(){ return assetPanel; }, enumerable: true });
    Object.defineProperty(scope, 'assetCloseBtn', { get(){ return assetCloseBtn; }, enumerable: true });
    Object.defineProperty(scope, 'assetLibrarySelect', { get(){ return assetLibrarySelect; }, enumerable: true });
    Object.defineProperty(scope, 'assetCategorySelect', { get(){ return assetCategorySelect; }, enumerable: true });
    Object.defineProperty(scope, 'assetGrid', { get(){ return assetGrid; }, enumerable: true });
    Object.defineProperty(scope, 'assetPromptLibrary', { get(){ return assetPromptLibrary; }, enumerable: true });
    Object.defineProperty(scope, 'assetDropZone', { get(){ return assetDropZone; }, enumerable: true });
    Object.defineProperty(scope, 'assetImageControls', { get(){ return assetImageControls; }, enumerable: true });
    Object.defineProperty(scope, 'assetDialogBackdrop', { get(){ return assetDialogBackdrop; }, enumerable: true });
    Object.defineProperty(scope, 'assetDialogTitle', { get(){ return assetDialogTitle; }, enumerable: true });
    Object.defineProperty(scope, 'assetDialogInput', { get(){ return assetDialogInput; }, enumerable: true });
    Object.defineProperty(scope, 'assetDialogCancel', { get(){ return assetDialogCancel; }, enumerable: true });
    Object.defineProperty(scope, 'assetDialogOk', { get(){ return assetDialogOk; }, enumerable: true });
    Object.defineProperty(scope, 'assetHoverPreview', { get(){ return assetHoverPreview; }, enumerable: true });
    Object.defineProperty(scope, 'imageQuickToolbar', { get(){ return imageQuickToolbar; }, enumerable: true });
    Object.defineProperty(scope, 'imageHdPopover', { get(){ return imageHdPopover; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetPanel', { get(){ return promptPresetPanel; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetClose', { get(){ return promptPresetClose; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetStatus', { get(){ return promptPresetStatus; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetSelect', { get(){ return promptPresetSelect; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetName', { get(){ return promptPresetName; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetText', { get(){ return promptPresetText; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetApply', { get(){ return promptPresetApply; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetDelete', { get(){ return promptPresetDelete; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetNew', { get(){ return promptPresetNew; }, enumerable: true });
    Object.defineProperty(scope, 'promptPresetSave', { get(){ return promptPresetSave; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplatePanel', { get(){ return promptTemplatePanel; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateClose', { get(){ return promptTemplateClose; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateSearch', { get(){ return promptTemplateSearch; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateLibrarySelect', { get(){ return promptTemplateLibrarySelect; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateCats', { get(){ return promptTemplateCats; }, enumerable: true });
    Object.defineProperty(scope, 'promptTemplateBody', { get(){ return promptTemplateBody; }, enumerable: true });
    Object.defineProperty(scope, 'composerTemplateBtn', { get(){ return composerTemplateBtn; }, enumerable: true });
    Object.defineProperty(scope, 'canvasEmptyHint', { get(){ return canvasEmptyHint; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_PRESETS_KEY', { get(){ return PROMPT_PRESETS_KEY; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_TEMPLATE_GROUPS_KEY', { get(){ return PROMPT_TEMPLATE_GROUPS_KEY; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_TEMPLATE_OVERRIDES_KEY', { get(){ return PROMPT_TEMPLATE_OVERRIDES_KEY; }, enumerable: true });
    Object.defineProperty(scope, 'smartCascadeRuns', { get(){ return smartCascadeRuns; }, enumerable: true });
    Object.defineProperty(scope, 'smartNodeRunTokens', { get(){ return smartNodeRunTokens; }, enumerable: true });
    Object.defineProperty(scope, 'UNDO_LIMIT', { get(){ return UNDO_LIMIT; }, enumerable: true });
    Object.defineProperty(scope, 'undoStack', { get(){ return undoStack; }, enumerable: true });
    Object.defineProperty(scope, 'EDIT_DRAW_HISTORY_MAX', { get(){ return EDIT_DRAW_HISTORY_MAX; }, enumerable: true });
    Object.defineProperty(scope, 'PANORAMA_RATIO_PRESETS', { get(){ return PANORAMA_RATIO_PRESETS; }, enumerable: true });
    Object.defineProperty(scope, 'MS_GEN_MODELS', { get(){ return MS_GEN_MODELS; }, enumerable: true });
    Object.defineProperty(scope, 'SIZE_MAP', { get(){ return SIZE_MAP; }, enumerable: true });
    Object.defineProperty(scope, 'RES_LONG_SIDE', { get(){ return RES_LONG_SIDE; }, enumerable: true });
    Object.defineProperty(scope, 'RES_PIXEL_LIMIT', { get(){ return RES_PIXEL_LIMIT; }, enumerable: true });
    Object.defineProperty(scope, 'escapeAttr', { get(){ return escapeAttr; }, enumerable: true });
    Object.defineProperty(scope, 'RECENT_SMART_SETTINGS_KEY', { get(){ return RECENT_SMART_SETTINGS_KEY; }, enumerable: true });
    Object.defineProperty(scope, 'initialSmartSettings', { get(){ return initialSmartSettings; }, enumerable: true });
    Object.defineProperty(scope, 'IMAGE_DBLCLICK_MS', { get(){ return IMAGE_DBLCLICK_MS; }, enumerable: true });
    Object.defineProperty(scope, 'MEDIA_NODE_DEFAULT_SCALE', { get(){ return MEDIA_NODE_DEFAULT_SCALE; }, enumerable: true });
    Object.defineProperty(scope, 'MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE', { get(){ return MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE; }, enumerable: true });
    Object.defineProperty(scope, 'MEDIA_GROUP_DEFAULT_SCALE', { get(){ return MEDIA_GROUP_DEFAULT_SCALE; }, enumerable: true });
    Object.defineProperty(scope, 'MEDIA_GROUP_THUMB_BASE', { get(){ return MEDIA_GROUP_THUMB_BASE; }, enumerable: true });
    Object.defineProperty(scope, 'EMPTY_UPLOAD_NODE_WIDTH', { get(){ return EMPTY_UPLOAD_NODE_WIDTH; }, enumerable: true });
    Object.defineProperty(scope, 'EMPTY_UPLOAD_NODE_HEIGHT', { get(){ return EMPTY_UPLOAD_NODE_HEIGHT; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_NODE_DEFAULT_WIDTH', { get(){ return PROMPT_NODE_DEFAULT_WIDTH; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_NODE_DEFAULT_HEIGHT', { get(){ return PROMPT_NODE_DEFAULT_HEIGHT; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_NODE_LEGACY_WIDTHS', { get(){ return PROMPT_NODE_LEGACY_WIDTHS; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_NODE_LEGACY_HEIGHTS', { get(){ return PROMPT_NODE_LEGACY_HEIGHTS; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_NODE_TEXT_DEFAULT_H', { get(){ return PROMPT_NODE_TEXT_DEFAULT_H; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_NODE_TEXT_MIN_H', { get(){ return PROMPT_NODE_TEXT_MIN_H; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_NODE_TEXT_MAX_H', { get(){ return PROMPT_NODE_TEXT_MAX_H; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_LLM_INSTRUCTION_DEFAULT_H', { get(){ return PROMPT_LLM_INSTRUCTION_DEFAULT_H; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_LLM_INSTRUCTION_MIN_H', { get(){ return PROMPT_LLM_INSTRUCTION_MIN_H; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_LLM_INSTRUCTION_MAX_H', { get(){ return PROMPT_LLM_INSTRUCTION_MAX_H; }, enumerable: true });
    Object.defineProperty(scope, 'PROMPT_SPLIT_RESIZE_BAR_H', { get(){ return PROMPT_SPLIT_RESIZE_BAR_H; }, enumerable: true });
    Object.defineProperty(scope, 'DEFAULT_VIDEO_MODELS', { get(){ return DEFAULT_VIDEO_MODELS; }, enumerable: true });
    Object.defineProperty(scope, 'RH_KNOWN_FIELD_OPTIONS', { get(){ return RH_KNOWN_FIELD_OPTIONS; }, enumerable: true });
    Object.defineProperty(scope, 'MASK_BRUSH_ALPHA', { get(){ return MASK_BRUSH_ALPHA; }, enumerable: true });
    Object.defineProperty(scope, 'MASK_BRUSH_COLOR', { get(){ return MASK_BRUSH_COLOR; }, enumerable: true });
    Object.defineProperty(scope, 'SMART_IMAGE_DROP_EXT_RE', { get(){ return SMART_IMAGE_DROP_EXT_RE; }, enumerable: true });
    Object.defineProperty(scope, 'SMART_IMAGE_DROP_TEXT_TYPES', { get(){ return SMART_IMAGE_DROP_TEXT_TYPES; }, enumerable: true });
    Object.defineProperty(scope, 'SMART_IMAGE_DROP_TYPE_HINT_RE', { get(){ return SMART_IMAGE_DROP_TYPE_HINT_RE; }, enumerable: true });
    Object.defineProperty(scope, 'smartLoopPromptVisiting', { get(){ return window.SmartCanvasSmartLoop?.smartLoopPromptVisiting; }, enumerable: true });
    Object.defineProperty(scope, 'imageHdCancel', { get(){ return imageHdCancel; }, enumerable: true });
    Object.defineProperty(scope, 'imageHdApply', { get(){ return imageHdApply; }, enumerable: true });
    Object.defineProperty(scope, 'assetAddCategoryBtn', { get(){ return assetAddCategoryBtn; }, enumerable: true });
    Object.defineProperty(scope, 'assetRenameCategoryBtn', { get(){ return assetRenameCategoryBtn; }, enumerable: true });
    Object.defineProperty(scope, 'entryBounceTimers', { get(){ return entryBounceTimers; }, enumerable: true });
    Object.defineProperty(scope, 'emptyHintDoubleBtn', { get(){ return emptyHintDoubleBtn; }, enumerable: true });
    Object.assign(scope, {
        absorbImageNodeIntoSmartGroup, activateImageDoubleClick, activatePromptNodeDoubleClick, activeAssetCategory, activeAssetLibrary, activeAssetTabCategory, activeComposerNode, activeInputImagesFor, activePromptLibrary, activePromptTemplateGroups, activePromptTemplateNodeId, activeSettingsSubject,
        activeSmartCascadeCount, activeWorkflowAssetCategory, addConnection, addCreatedNodeToMenuGroup, addDraggedNodeToSmartGroup, addDraggedNodesToSmartGroup, addFilesToLocalAssetLibrary, addLocalPathsToLocalAssetLibrary, addManualReferenceToSelectedNode, addNodeToSmartGroup, addSmartGenerationLog, addUrlItemsToLocalAssetLibrary,
        addUrlToAssetLibrary, animateViewportTo, apiImageSize, apiProviderById, appendCascadeRefsToReceiver, appendImagesToSmartNode, appendLoopOutputsToNode, appendOutputsToNode, applyCropDragMove, applyGridJoinPreset, applyGridPreset, applyImageBrush,
        applyImageCrop, applyImageCutout, applyImageEdit, applyImageEditZoom, applyImageGridJoin, applyImageGridSplit, applyImageMask, applyImageOutpaint, applyJimengQueryResult, applyManualVideoUrlToSmartRef, applyMergedServerCanvas, applyNodeMetaToImage,
        applyOutpaintSizeToSmartParams, applyPanoramaRatio, applyPanoramaTexture, applyPreviewTransform, applyPromptTemplateToNode, applyRecentSmartSettingsForCurrentMode, applySourceRatioToSettings, applyTheme, applyThumbDisplaySizeToElement, applyUploadedUrlsToSmartRefs, applyViewport, arrangeSelectedNodes,
        arrangeSmartGroupMembers, assetCategories, assetCategoryAncestors, assetCategoryById, assetCategoryForMention, assetChildCategories, assetLibraries, assetLibraryIsLocal, assetMediaKind, assetMentionCandidateImages, assetRegisteredUris, assetSmartClassEntries,
        assetSmartClassKey, assetSmartClassOptionId, assetThumbHtml, attachRunMeta, audioRefsOnly, autosizeEditTextInlineEditor, backToCanvasList, beginCropDrag, beginEditDraw, beginEditText, beginEditTextInline,
        beginGridJoinDrag, beginTextEditChange, bindAssetItemEvents, bindConnectionEvents, bindDynamicParams, bindImageProxyFallback, bindInputThumbReferenceActions, bindInputThumbsDrag, bindLoopNodeControls, bindNodeEvents, bindPromptNodeControls, bindScrollableText,
        bindSmartPreviewImageFallbacks, bindWorkflowAssetItemEvents, blockedInputRefKeys, brushColor, buildPromptRequest, buildPromptRequestForNode, canAutoConnectDraggedNode, canGridJoinCurrentNode, canRunSmartCascade, cancelSmartNodeGeneration, cancelSmartPendingTask, cancelSmartPendingSlot, cancelViewportAnimation, candidateInputImagesFor,
        canvasAgentObservation, canvasAssetLibraryForCurrentCanvas, canvasForStorage, canvasImageDragPayload, canvasListUrlForProject, captureMediaPlaybackState, captureMediaPlaybackStates, capturePendingUndo, cascadeConnectionKeys, cascadeOutputTitle, cascadeRefsFromOutputs, cascadeTailForLoop,
        centerViewportOnWorldPoint, chatApiProviders, chatModelOptions, chatProviderOptions, circledNumber, clampCrop, clampOutpaint, clampPromptSplitHeights, cleanHistoryImages, cleanupDetachedRunInputRefs, cleanupSmartLogPreviewNode, clearCompletedNodeBusyStates,
        clearCompletedSourceBusyStates, clearCutoutSelection, clearDetachedRunInputRefs, clearDropHighlight, clearEditDrawing, clearGridCustomLines, clearImageClickTimer, clearInputThumbDropMarkers, clearManualSmartVideoUrl, clearNodeMediaBeforeDelete, clearNodeRunningState, clearPortDragVisual,
        clearPromptInput, clearSelection, clearSmartNodeBusyState, clearSourceBusyStateIfDownstreamDone, clearVolcengineSelectionOutsideVolcengine, cloneSmartNode, cloneSmartSettings, closeAllSmartPopovers, closeComposerHdPopover, closeCreateMenu, closeImageEditor, closeMentionPicker,
        closePromptPresetPanel, closePromptTemplatePanel, closeSmartCanvasLog, closeSmartCanvasShortcuts, closeSmartLogLightbox, closeSmartWorkflowTransferModal, collapseCanvasOverlays, collectMentionedImagesFromPrompt, collectPromptParts, comfyFieldKind, comfyNameForRef, comfyParamValue,
        comfyParamsFromWorkflowValues, comfyRandomEnabledField, commitPendingUndo, completeSmartNodeWithImages, completedDownstreamOutputForNode, confirmSelectedEditTextItem, connectAssetLibrarySyncSocket, connectInputNode, connectedLineNodeIds, connectionMidpoint, controlTypeKey, coolNodeRunningState,
        coolRunButton, copyMediaSizeFields, copySelectedNodes, createAssetFolder, createAssetFolderAt, createBlankPromptTemplate, createEditTextItem, createImageNodeAt, createLoopNode, createLoopOutputSlot, createNewSmartCanvas, createNode,
        createNodeFromMenu, createParallelLoopOutputNode, createPendingOutputBatchFromSource, createPendingOutputFromSource, createPromptNode, createPromptPresetFromComposer, createPromptPresetFromNode, createPromptTemplateGroup, createSmartComfyTask, createSmartGroupNode, cropBounds, cropImageDisplaySize, currentAssetSourceLibraries,
        currentAssetTabCategories, currentAssetTabIsWorkflow, currentComfyFields, currentComposerSubject, currentEditImage, currentGridJoinItems, currentPreviewVideo, currentPromptPreset, currentRunningHubWorkflowConfig, currentSmartMediaLinks, currentSmartMediaRefs, currentUploadMediaRefs,
        cutoutSourcePixels, cutoutTolerance, dataTransferItemEntry, decodeSmartDropText, defaultEditTextText, defaultInputImagesFor, defaultPromptPresetName, defaultPromptTemplateGroups, defaultReferenceImagesFor, defaultSmartApiResolution, deleteAssetCategory, deleteImage,
        deleteLocalAssetFromPanel, deleteNode, deleteNodeFromButton, deletePromptTemplate, deletePromptTemplateGroup, demoteHistoryGroupNode, directImageInputsFor, directImageInputsForKinds, directLoopRunTargets, discardPendingUndo, disconnectConnection,
        disconnectConnections, displayBoxFromNaturalSize, displayMediaUrl, disposePanoramaPreview, disposePanoramaTexture, downloadBlob, downloadNameForMediaItem, downloadNodeImage, downloadPreviewFile, downloadPreviewGroup, downloadPreviewImage, downloadSmartGroupImages,
        downstreamCascadeTargetsFor, downstreamImageTargetsFor, downstreamNodesForId, downstreamWorkflowImageTargetsFor, dragConnectTargetFor, drawBrushShape, drawImageCover, drawNumberLabel, drawPanoramaFrame, duplicateForAltDrag, duplicateSmartNodeMediaToCanvas, dynamicParamsScrollSnapshot,
        easeOutCubic, editBrushSize, editCanvasHasPixels, editDrawCanvas, editDrawPoint, editDrawSnapshot, editPromptPresetForNode, editTextCanvas, editTextCanvasScale, editTextContext, editTextHasContent, editTextPoint,
        editTextSizeFromBrush, endCropDrag, endEditDraw, endEditText, endGridJoinDrag, engageSmartGroup, ensureCanvasAssetLibrary, ensureComfyWorkflow, ensureGridJoinLayout, ensureHistoryGroupForNode, ensureImageDimensions, ensureImageEditBaseSize,
        ensurePanoramaRenderer, ensurePortDragPathElement, ensureRunningHubWorkflow, ensureSmartCanvasId, enterZoomPreview, escapeHtml, exceedsFourKStandard, executeCanvasAgentActions, exitZoomPreview, exitZoomPreviewToNode, expectedOutputSize, explicitRequestOutputSizeForPending,
        exportPanoramaFrame, exportSelectedSmartWorkflow, exportVideoFrame, extensionForMediaItem, extractCurrentImagesToSource, extractUpstreamTaskId, fetchImageTaskQuery, fetchJimengQuery, fetchSmartCanvasRecords, fileNameFromUrl, filesFromEntry, filterJimengImageModels,
        filterJimengVideoModels, finalizeOverwritePendingNode, finalizePendingNode, finalizeSmartPendingTask, finishLoopTargetPreviewState, finishSelection, fitAllNodesViewport, fitSmartGroupFrameToMembers, fitSmartLoopNode, fitViewportToImageWithComposer, fitViewportToPromptNode, formatRunDuration,
        gcdInt, generateComfyUrlsWithSettings, generateUrlsForCurrentSettings, getElementWorldRect, gridCustomLineHit, gridGapInputValue, gridJoinAutoDims, gridJoinBaseCellSize, gridJoinCanvasSize, gridJoinDragTarget, gridJoinItemDisplaySize, gridJoinNaturalSize,
        gridJoinVisualOrder, gridLayoutFromRects, gridSplitRects, gridSplitRectsCustom, gridSplitSettings, groupImageGridLayout, groupSelectedNodes, handleAssetLibraryUpdatedMessage, handleAssetPanelDragOver, handleAssetPanelDrop, handleCanvasUpdatedMessage, handleFiles,
        handleJimengPendingSignal, handlePortDrop, handleSmartImageDropPayload, hasCanvasImageDrag, hasDownstreamImageNode, hasDownstreamWorkflowImageNode, hasHistoryConnection, hasMediaDrawerDrag, hasSmartAssetDrag, hasSmartImageDropData, hasSmartInputThumbDrag, hideAssetHoverPreview,
        hideCompletedRunTimers, hideImageQuickToolbar, hideRunTimerForNode, historyGroupForNode, hitEditTextItem, imageForDisplay, imageLayout, imageMetaFromNode, imageProviders, imageQuickActionMeta, imageRefsOnly, imageResolutionBadgeHtml,
        imageResolutionLabel, imageSizeForRatio, imageTaskRecoverBodyHtml, imagesForNode, importSmartLocalImages, importSmartWorkflowFile, incomingLineConnectionsFor, inheritNodeMetaFromImage, inlineEditorText, inputImagesFor, inputMentionCandidateImages, inputNodesFor,
        inputPromptTextFor, inputRefKey, inputThumbDropPlacement, insertLoopNodeIntoConnection, insertMentionToken, insertSmartLoopToken, insertSmartWorkflowIntoCanvas, insertionConnectionForNode, invertCutoutSelection, isApiLikeEngine, isAudioMediaItem, isDirectLoopTargetRun,
        isEditableTarget, isFileMediaItem, isGeneratedOutputForNode, isGptImageAutoSizeModel, isHistoryGroupNode, isInlineVideoActive, isInputRefBlocked, isLikelyPanoramaImage, isLocalSmartImageDropValue, isNodeSelected, isRemoteSmartImageDropValue, isRemoteVideoReferenceUrl,
        isSelfReferenceForNode, isSmartGroupCompactMember, isSmartGroupNode, isSmartImageNode, isSmartLoopDefaultPrompt, isSmartPreviewImage, isSmartRunnableNode, isSupportedUploadFile, isTextMediaItem, isVideoMediaItem, jimengImageEditMode, jimengPendingBodyHtml,
        jimengQueueText: (...a) => window.SmartCanvasGeneration?.jimengQueueText?.(...a), jimengVideoCommand, lineConnectionsFor, lineImagesFor, liveSmartNode, loadAssetLibrary, loadCanvas, loadConfig, loadGridJoinImage, loadNodePromptDraftToInput, loadPanoramaTexture,
        loadPromptDraft, loadPromptPresets, loadPromptTemplateGroups, loadPromptTemplateOverrides, loadPromptTemplates, loadRecentSmartSettings, loadSmartOriginalImageDimensions, localAssetFolderCategories, localAssetFolderPath, localDisplayUrlForMediaItem, looksLikeImageMediaUrl, loopNumberControlHtml,
        loopOutputSlotForRound, loopOutputSlotsForRoot, manualReferenceImagesFor, manualSmartMediaLinks, manualSmartVideoLink, markControlInteracting, markSmartNodeComplete, maskCanvasFromDrawCanvas, maybeOpenMentionPicker, measureEditTextItem, measureSmartNodeImages, mediaItemForStorage,
        mediaKindForFile, mediaKindForItem, mediaKindForUrls, mediaLayoutSize, mediaNodeDefaultScale, mediaRefSourceUrl, mediaSignaturePartFromElement, mentionCandidateImages, mentionOptionMediaHtml, mentionTokenHtml, mentionTokenMediaHtml, mergeImageNodesIntoGroup,
        mergeReloadCanvasNow, mergeSmartConnections, mergeSmartImageLists, mergeSmartNode, mergeSmartNodeLists, migrateSmartGroupImageMembers, minimapEventToWorld, modelscopeImageModels, modelscopeProvider, moveEditDraw, moveEditText, moveGridJoinDrag,
        moveNodeElementsDuringDrag, msModelLabel, navigatePreviewImage, nearestFourKSizeFor, nextOutputPositionForSource, nodeBodyHtml, nodeHasIncomingSourceLine, nodeHasReferenceContent, nodeRect, nodeRunElapsedMs, nodeScale, nonPreviewOutputImages,
        normalizeActiveAssetCategory, normalizeApiSizeSettings, normalizeImportedSmartWorkflow, normalizeLegacySmartNode, normalizeMaskPreviewCanvas, normalizeSmartImageMode, normalizedSizeLabel, noteImageClickForDouble, nowMs, openAssetNameDialog, openControlState, openCreateMenu,
        openGroupGridJoin, openGroupImagePreview, openImageEditor, openImagePreview, openImagePreviewSmart, openImageQuickAction, openPromptPresetPanel, openPromptTemplatePanel, openSmartCanvasLog, openSmartCanvasShortcuts, openSmartWorkflowTransferModal,
        optionHtml, originalPromptTextFromParts, outgoingConnectionsFor, outgoingInputConnectionsFor, outpaintNaturalSize, outputImagesForNode, outputUrlLooksVideo, panoramaFallbackSource, panoramaRatioValue, panoramaResolutionValue, panoramaSource, parseRatioValue,
        parseRunningHubEntryKey, parseSizePair, parseSizeValue, pasteAssetsFromInbox, pasteNodes, pendingBaseBoxSize, pendingBoxSize, pendingSizeFromImageRef, pendingSourceBoxSize, performUndo, persistActiveSmartSettings, pickMediaForSmartNode,
        placeMentionPickerInComposerCard, placeMentionPickerInPromptRow, pollSmartCanvasTask, positionAssetHoverPreview, positionComposerForNode, positionEditTextInlineEditor, positionHistoryGroupForNode, positionImageHdPopover, positionImageQuickToolbar, positionMentionPickerAtCaret, previewCompareSources, previewDownloadGroupItems,
        previewResolutionText, primaryImageInputFor, promptHtmlWithMentionTokens, promptInputNodesFor, promptLlmInstructionHeight, promptNodeBodyHtml, promptNodeContentHeight, promptNodeExpandedHeight, promptNodeInputImages, promptNodeInputMediaForLLM, promptNodeLLMInputText, promptNodeLayoutSize,
        promptNodeMinHeight, promptNodePromptItems, promptNodeSeparator, promptNodeSplitExtraHeight, promptNodeSplitPreviewHeight, promptNodeTextHeight, promptNodeUpstreamPromptItems, promptNodeUpstreamPromptText, promptPlainText, promptPresetPanelNode, promptTemplateCategoryLabel, promptTemplateItems,
        promptTemplateName, promptTemplateScene, promptTemplateScrollSnapshot, promptTemplateSearchText, promptTemplateSelectedItem, promptTemplateText, promptTextItemsForNode, providerChatModels, providerIdForSmartTask, providerImageModels, providerVideoModels, proxiedMediaUrl,
        pruneSmartGroupMembershipsForNode, pushCutoutHistory, pushEditDrawHistory, pushRightSideNodes, pushUndo, queryJimengNow, querySmartImageTaskNow, queueSmartNodeDrag, ratioIconClass, ratioLabel, readAssetInbox, readSmartDropData,
        recentSmartSettingsForMode, recoverStuckLoopOutputsFromLogs, rectOverlapNode, redoEditDrawing, reducedRatioForImage, referenceImagesFor, refreshAssetLibrarySoon, refreshComparePanel, refreshConnectionLayer, refreshCutoutFromControls, refreshGridSplitPreview, refreshIcons,
        refreshPanoramaControls, refreshPromptNodeSegmentsUi, refreshRunTimerPills, refreshSmartConfigFromSettings, refsForDirectLoopRound, relayLoopPromptNodesForEdge, relayLoopPromptNodesForTarget, rememberCanvasListProject, rememberInlineVideoActivations, rememberPreviewImageResolution, rememberRecentSmartSettings, rememberRoundOutputs,
        removeEditTextInlineEditor, removeManualReferenceFromSelectedNode, renameAssetCategory, renamePromptTemplateGroup, render, renderApiParams, renderApiVideoParams, renderAssetLibrary, renderComfyParams, renderComfySettingField, renderComfyWorkflowControl,
        renderComposerHeadParams, renderConnections, renderCountControl, renderCountVisualControl, renderCropBox, renderCustomRatioControls, renderCustomSizeControls, renderCutoutSelection, renderDynamicParams, renderEditTextCanvas, renderGridJoinPreview, renderInlineCustomRatioFields,
        renderInlineCustomSizeFields, renderInputPromptPreview, renderInputThumbsRow, renderManualVideoUrlControl, renderMentionPicker, renderMinimap, renderModelControl, renderMsCustomModelPill, renderMsFunctionControl, renderMsParams, renderPanoramaFrame, renderPromptLibrarySelect,
        renderPromptPresetPanel, renderPromptTemplatePanel, renderProviderControl, renderQualityControl, renderRatioControl, renderResolutionControl, renderRhConfigControl, renderRhMachineControl, renderRhPaymentControl, renderRhSettingField, renderRunningHubParams, renderSizeControls,
        renderSizePickerControl, renderSmartCanvasLog, renderTempShUploadControl, renderUpscalePill, renderVideoAspectControl, renderVideoDurationControl, renderVideoModelControl, renderVideoResolutionControl, renderVideoToggleControl, renderVideoTrustedAssetControl, renderVolcengineParams, renderVolcengineVideoParams,
        renderedInputMediaRefs, reorderInputThumb, replaceEditedImage, replaceOutputsToNodeDirect, replaceOutputsToNodeWithHistory, requestSmartCascadeStop, rerouteSmartConnections, resetCropBox, resetEditDrawingHistory, resetGridJoinLayout, resetImageEditZoom, resetOutpaintBox,
        resetPanoramaView, resetPreviewTransform, resetPromptPresetDeleteState, resizeEditDrawCanvas, resizeEditTextCanvas, resizeOutpaintFromDrag, resizePanoramaViewer, resolutionLabel, resolveChatModel, resolveChatProviderId, resolveImageDimensions, resolveSmartCascadeLoop,
        resolveSmartImageDropPayload, restoreDraggedNodePosition, restoreDynamicParamsScroll, restoreEditDrawSnapshot, restoreFromExtraction, restoreMediaPlaybackState, restoreMediaPlaybackStates, restoreOpenControl, restorePromptTemplateScroll, restoreSourceVisualState, resultMediaUrls, resumeJimengPendingNodes,
        resumeSmartPendingNode, resumeSmartPendingTasks, rhActiveFields, rhBuildNodeInfoList, rhBuildWorkflowRequestExtras, rhCurrentKind, rhDefaultPromptSuggestion, rhDefaultValue, rhEntryFields, rhExtractFieldOptions, rhFieldIndexes, rhFieldKind,
        rhFieldRole, rhIsWorkflowLinkValue, rhMediaForRun, rhParamKey, rhParamValue, rhPromptPlaceholder, rhPruneWorkflowForMissingFields, rhRandomEnabled, rhRequiredLabel, rhUploadValueIfNeeded, rhUsableFields, rhUserParamValue,
        rhWorkflowJsonFromSources, runApiGeneration, runApiVideoGeneration, runCascadeStepIntoNode, runComfyEdit, runComfyEnhance, runComfyGeneration, runComfyText, runGeneration, runLoopRoundIntoSlot, runModelscopeGeneration, runPromptLLMNode,
        runQueuedSmartComfyGenerate, runRunningHubGeneration, runSmartCascade, runSmartCascadeFromLoop, runSmartCascadeRoundsWithLimit, runSmartGroupToolbarAction, runSmartNodeToolbarAction, runTimePillHtml, runningHubAllEntries, runningHubEntries, runningHubEntryId, runningHubEntryKey,
        runningHubEntryLabel, runningHubProvider, runningHubRunNeedsPrompt, safeExportFileName, safeScale, sameOrderedIds, sanitizeSmartApiSelection, saveCanvas, saveCurrentPromptAsTemplate, saveMentionRange, savePromptDraftForCurrent, savePromptNodeAsPreset,
        savePromptPresets, savePromptTemplateEdit, savePromptTemplateGroups, savePromptTemplateOverrides, saveRecentSmartSettings, scaleSizeToLongSide, scaleSmartGroupMemberToZoom, scaledImageSizeForSelectedNode, scheduleCanvasMergeReload, scheduleComposerReposition, scheduleConnectionLayerRefresh, scheduleInteractionLayerRefresh,
        scheduleSave, screenToWorld, seekPreviewVideoFrames, seekVideoForFrame, selectCanvasImage, selectCanvasImageFromEvent, selectCutoutAt, selectInlineEditorText, selectSmartGroup, selectedEditTextItem, selectedImageElement, selectedImageForHd,
        selectedNode, selectedNodeIds, selectedRunningHubRef, selectedSmartWorkflowPayload, selfReferenceImagesForNode, serializableSmartNode, setActiveCanvasId, setAssetDragOver, setAssetGridSize, setAssetLibraryFromResponse, setBrushTool, setComposerHdScale,
        setCurrentSmartManualVideoUrl, setDropHighlight, setDynamicSetting, setGridCustomLinePos, setGridCustomOrientation, setGridJoinLayoutOrder, setGridJoinOutputSize, setGridOperationMode, setImageEditMode, setImageEditorContext, setLocalAssetLibraryFromResponse, setNodeJimengPending,
        setPanoramaEnabled, setPreviewComparePos, setPromptCaretToEnd, setPromptDraftForNode, setPromptInputLocked, setPromptPresetStatus, setPromptText, setSelectedEditTextItem, setSmartDropCopyEffect, setSmartImageMode, setSmartLoopPromptFieldValues, settingsForStorage,
        setupDrawStyle, shellPoint, showAssetHoverPreview, showDirectLoopRoundPreview, showImageHdPopover, showImageQuickToolbar, showMentionPicker, showSmartGroupCapsule, singleImageLayout, singleMediaHtml, sizeForRun, sizeForRunAsync,
        sizePickerDefaultResolution, sizePickerLabel, sizePickerScope, sleep, smartActivateVideoPreview, smartCanvasUrl, smartCascadeAbortError, smartCascadeAnyRunning, smartCascadeEdgeState, smartCascadeGraphForTail, smartCascadeIsLoopRunning, smartCascadeParallelLimit,
        smartCascadePathForCtx, smartCascadeRunForLoop, smartCascadeStopText, smartComfyRandomActive, smartComfyRandomActiveFor, smartComfyRandomValue, smartDropDataTypes, smartDropTextCandidates, smartDropTextFragments, smartGroupAtWorldPoint, smartGroupBodyHtml, smartGroupCompactMembers,
        smartGroupContainingNode, smartGroupImageGridLayout, smartGroupImageRefs, smartGroupLayoutSize, smartGroupMembers, smartGroupScopeId, smartGroupTargetForDraggedNode, smartGroupThumbLayout, smartGroupToolbarHtml, smartGroupZoom, smartImageChainTo, smartImageDropPayload,
        smartImageFilesFromDataTransfer, smartImageMode, smartImageNameFromUrl, smartImageUsesWorkflowInput, smartLocalImagePathsFromDataTransfer, smartLogOutputItem, smartLogPreviewNode, smartLogSizeSummary, smartLoopActivePromptFieldValues, smartLoopBodyHtml, smartLoopCount, smartLoopDefaultPromptText,
        smartLoopEditorText, smartLoopHeight, smartLoopInputImages, smartLoopInputPromptItems, smartLoopPreviewImages, smartLoopPrompt, smartLoopPromptFieldText, smartLoopPromptFieldValues, smartLoopRoundSettings, smartLoopSelectedInputPrompt, smartLoopSelectedLocalPrompt, smartLoopTokenChipHtml,
        smartLoopTokenLabel, smartLoopUpstreamPromptPreviewHeight, smartLoopVariableHtml, smartLoopWidth, smartMediaPreviewUrl, smartNodeHasCompletedResult, smartNodeHasDisplayResult, smartNodeHasLiveMedia, smartNodeInFlight, smartNodeInputThumbRows, smartNodeInputThumbsHeight, smartNodeInputThumbsHtml,
        smartNodeToolbarHtml, smartNodeToolbarImageIndex, smartOriginalMediaUrl, smartPendingTasks, smartRecoverableImageTask, smartResponseErrorMessage, smartRhRandomActive, smartRhRandomActiveFor, smartRhRandomValue, smartRunNeedsPrompt, smartRunPlatformLabel, smartRunRequestMeta,
        smartRunSnapshot, smartRunTaskLabel, smartSettingsForNode, smartSettingsModeKey, snapOutputSize, snapshotForUndo, snapshotRunMeta, sortRunningHubFields, sourceImageRatioLabel, sourceRatioImageForNode, sourceReferenceImageCandidates, sourceReferenceImageForSize,
        sourceReferenceImageForSizeAsync, splitManualMediaUrls, splitSmartPromptItems, startCanvasMetaPoll, startJimengPoll, startPanoramaLoop, stopPanoramaLoop, stripImageGenerationMeta, stripOutpaintDisplaySettings, stripRunInputMeta, strokeFreeDrawPoint,
        successfulRecentComfyLogOutputs, syncActiveCanvasAssetLibrary, syncApiKindToggleVisibility, syncApiProvidersFromModule, syncBrushToolButtons, syncCascadeRunButton, syncComposerHdVisibility, syncComposerTemplateButton, syncEditDrawingHistoryButtons, syncGridCustomControls, syncGridCustomCursor, syncGridCustomUndoBtn,
        syncGridGapValue: (...a) => window.SmartCanvasImageEdit?.syncGridGapValue?.(...a), syncGridJoinSizeControls, syncGridOperationControls, syncImageEditOverflow, syncJimengModelPillForRefs, syncJimengVideoModelPillForRefs, syncPreviewFrameSize, syncPromptNodeElementHeights, syncPromptNodeHeightForSplit, syncRunButtonState, syncSelectedEditTextStyleFromBrush, syncSelectionUi,
        syncSmartCascadeLegacyState, syncSmartGroupMemberElements, syncTextToolState, tagLoopOutputSlot, tempShUploadedUrlFor, textBeforeCaret, textForNode, textItemFont, throwIfSmartCascadeStopRequested, thumbDisplaySize, thumbItemStyle, thumbMediaHtml,
        toast, toggleAssetLibrary, toggleAssetMentionPickerFromThumbs, toggleGridCustomMode, toggleInputRefBlocked, togglePanoramaPreview, togglePreviewCompare, toggleSmartComfyRandom, toggleSmartRhRandom, toggleZoomPreview, tr,
        transplantSmartMediaElements, trf, uid, undoCutoutSelection, undoEditDrawing, undoGridCustomLine, ungroupNode, uniqueReferenceImages, uniqueSmartDropValues, updateCanvasEmptyHint, updateComposer, updateEditTextCursor,
        updateImageResolutionBadgeElement, updateLoopInsertPreview, updateNodeElementDuringResize, updateOutpaintResolutionLabel, updatePortDragVisual, updatePreviewMetaHint, updatePreviewNavButtons, updatePromptPlaceholder, updatePromptSplitDuringResize, updateProviderModels, updateSelectionBox, updateSmartWorkflowTransferMeta,
        updateZoomLabel, uploadCroppedBlob, uploadCurrentSmartVideosToCloud, uploadFiles, uploadFilesFromDataTransfer, uploadImageBlobs, uploadMediaRefToCloud, uploadTitleForItems, upstreamLineNodeIds, upstreamLineReferenceImagesFor, upstreamLoopPromptNodesFor, upstreamNodesForId,
        upstreamNodesForKinds, urlToBase64, usedCanvasOutputUrls, validOutpaintSize, videoApiProviders, videoAspectIconClass, videoFrameStep, videoProviderById, videoProviderPlatform, videoRefsOnly, viewportCenter, visibleReferenceImagesFor,
        volcengineProvider, volcengineVideoModels, waitForVideoEvent, waitSmartComfyTaskResult, withOutpaintDisplaySettings, workflowAssetCategories, workflowInputImagesFor, workflowInputNodesFor, zipDownloadImageItems
    });
    _smartCanvasContextScope = scope;
    return scope;
}

function buildSmartCanvasUiContext(){
    return window.SmartCanvasUiContext?.buildSmartCanvasUiContext?.();
}

(function registerSmartCanvasUiContextScope(){
    window.SmartCanvasUiContext?.registerScopeFactory?.(getSmartCanvasContextScope);
})();
/* === D1b ui-context scope factory === */
/* bindSmartCanvasTopActions → SmartCanvasUiBindings.bindTopActions */
function uid(prefix){ return window.SmartCanvasStringUtils?.uid?.(prefix); }
function escapeHtml(str){ return window.SmartCanvasStringUtils?.escapeHtml?.(str); }
const escapeAttr = escapeHtml;
function cloneSmartSettings(source=settings){ return window.SmartCanvasSettingsStorage?.cloneSmartSettings?.(source); }
function settingsForStorage(source=settings){ return window.SmartCanvasSettingsStorage?.settingsForStorage?.(source); }
function isApiLikeEngine(engine){ return window.SmartCanvasSettingsStorage?.isApiLikeEngine?.(engine); }
function mediaItemForStorage(item){ return window.SmartCanvasSettingsStorage?.mediaItemForStorage?.(item); }
function canvasForStorage(){
    return window.SmartCanvasPersistence?.canvasForStorage() ?? (() => {
        const clean = JSON.parse(JSON.stringify(canvas || {}));
        clean.settings = settingsForStorage(canvasDefaultSmartSettings || initialSmartSettings);
        (clean.nodes || []).forEach(node => {
            if(Array.isArray(node.images)) node.images = node.images.map(mediaItemForStorage);
            if(node.runSettings) node.runSettings = settingsForStorage(node.runSettings);
        });
        return clean;
    })();
}
const RECENT_SMART_SETTINGS_KEY = 'smart_canvas_recent_run_settings_v1';
window.SmartCanvasSettingsStorage?.registerDeps?.({ settings });
const initialSmartSettings = cloneSmartSettings(settings);
let canvasDefaultSmartSettings = cloneSmartSettings(settings);
let recentSmartSettingsByMode = {};
const IMAGE_DBLCLICK_MS = 360;
let imageDblClickState = {nodeId:'', index:-1, time:0};
window.SmartCanvasCanvasHint?.registerDeps?.({
    getNodes: () => nodes,
    canvasEmptyHint,
    shell,
});
updateCanvasEmptyHint();
registerSmartCanvasModuleDeps();
SmartCanvasUiBindings?.bindTopActions?.(buildSmartCanvasUiContext());
scheduleSmartCanvasBootstrap.started = false;
(function initSmartCanvasBootEarly(){
    const run = () => scheduleSmartCanvasBootstrap();
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
    else run();
    window.addEventListener('load', run, {once:true});
})();
function smartSettingsModeKey(source=settings){ return window.SmartCanvasSettingsStorage?.smartSettingsModeKey?.(source); }
function loadRecentSmartSettings(){ return window.SmartCanvasSettingsRecent?.loadRecentSmartSettings?.(); }
function saveRecentSmartSettings(){ return window.SmartCanvasSettingsRecent?.saveRecentSmartSettings?.(); }
function recentSmartSettingsForMode(modeKey=''){ return window.SmartCanvasSettingsRecent?.recentSmartSettingsForMode?.(modeKey); }
function rememberRecentSmartSettings(source=settings, node=null){ return window.SmartCanvasSettingsRecent?.rememberRecentSmartSettings?.(source, node); }
function applyRecentSmartSettingsForCurrentMode(){ return window.SmartCanvasSettingsRecent?.applyRecentSmartSettingsForCurrentMode?.(); }
function isHistoryGroupNode(node){ return window.SmartCanvasNodeModel?.isHistoryGroupNode?.(node); }
function normalizeSmartImageMode(mode){ return window.SmartCanvasNodeModel?.normalizeSmartImageMode?.(mode); }
function smartImageMode(node){ return window.SmartCanvasNodeModel?.smartImageMode?.(node); }
function setSmartImageMode(node, mode){ return window.SmartCanvasNodeModel?.setSmartImageMode?.(node, mode); }
function smartImageUsesWorkflowInput(node, ctx=smartLoopContext){ return window.SmartCanvasNodeModel?.smartImageUsesWorkflowInput?.(node, ctx); }
function normalizeLegacySmartNode(node){ return window.SmartCanvasNodeModel?.normalizeLegacySmartNode?.(node); }
function ensureTypedPlaceholder(node, preferredKind){ return window.SmartCanvasNodeModel?.ensureTypedPlaceholder?.(node, preferredKind); }
function typedPlaceholderKind(node, preferredKind){ return window.SmartCanvasNodeModel?.typedPlaceholderKind?.(node, preferredKind); }
function validOutpaintSize(node){ return window.SmartCanvasNodeModel?.validOutpaintSize?.(node); }
function parseSizePair(value){ return window.SmartCanvasNodeModel?.parseSizePair?.(value); }
function nearestFourKSizeFor(width, height){ return window.SmartCanvasComposerSettings?.nearestFourKSizeFor?.(width, height); }
function exceedsFourKStandard(width, height){ return window.SmartCanvasComposerSettings?.exceedsFourKStandard?.(width, height); }
function withOutpaintDisplaySettings(node, baseSettings){ return window.SmartCanvasComposerSettings?.withOutpaintDisplaySettings?.(node, baseSettings); }
function stripOutpaintDisplaySettings(settingsObj, node=null){ return window.SmartCanvasComposerSettings?.stripOutpaintDisplaySettings?.(settingsObj, node); }
function smartSettingsForNode(node){ return window.SmartCanvasComposerSettings?.smartSettingsForNode?.(node); }
function activeSettingsSubject(){ return window.SmartCanvasComposerSettings?.activeSettingsSubject?.(); }
function activeComposerNode(){ return window.SmartCanvasComposerSettings?.activeComposerNode?.(); }
function persistActiveSmartSettings(){ return window.SmartCanvasComposerSettings?.persistActiveSmartSettings?.(); }
function backToCanvasList(){ return window.SmartCanvasCanvasNav?.backToCanvasList?.(); }
function promptPlainText(){ return window.SmartCanvasPromptInput?.promptPlainText?.(); }
function setPromptInputLocked(locked){ return window.SmartCanvasPromptInput?.setPromptInputLocked?.(locked); }
function setPromptText(text){ return window.SmartCanvasPromptInput?.setPromptText?.(text); }
function clearPromptInput(options={}){ return window.SmartCanvasPromptInput?.clearPromptInput?.(options); }
function applyTheme(theme){ return window.SmartCanvasUiFeedback?.applyTheme?.(theme); }
function toast(text){ return window.SmartCanvasUiFeedback?.toast?.(text); }
function selectedNode(){ return window.SmartCanvasNodeSelection?.selectedNode?.(); }
function clearSelection(){ return window.SmartCanvasNodeSelection?.clearSelection?.(); }
function clearImageClickTimer(){ return window.SmartCanvasNodeSelection?.clearImageClickTimer?.(); }
function activateImageDoubleClick(nodeId, imageIndex=0, imageEl=null){ return window.SmartCanvasNodeSelection?.activateImageDoubleClick?.(nodeId, imageIndex, imageEl); }
function fitViewportToPromptNode(node){ return window.SmartCanvasViewport?.fitViewportToPromptNode?.(node); }
function activatePromptNodeDoubleClick(node){ return window.SmartCanvasNodeSelection?.activatePromptNodeDoubleClick?.(node); }
function clampPromptSplitHeights(mainH, instrH){ return window.SmartCanvasPromptLayout?.clampPromptSplitHeights?.(mainH, instrH); }
function updatePromptSplitDuringResize(node, dy){ return window.SmartCanvasPromptLayout?.updatePromptSplitDuringResize?.(node, dy); }
function noteImageClickForDouble(nodeId, imageIndex=0, imageEl=null){ return window.SmartCanvasNodeSelection?.noteImageClickForDouble?.(nodeId, imageIndex, imageEl); }
function selectedImageElement(){ return window.SmartCanvasNodeSelection?.selectedImageElement?.(); }
function hideImageQuickToolbar(){
    return window.SmartCanvasImageEdit?.hideImageQuickToolbar?.();
}
function enterImageEditOverlay(){
    return window.SmartCanvasImageEdit?.enterImageEditOverlay?.();
}
function exitImageEditOverlay(){
    return window.SmartCanvasImageEdit?.exitImageEditOverlay?.();
}
function positionImageQuickToolbar(){
    return window.SmartCanvasImageEdit?.positionImageQuickToolbar?.();
}
function showImageQuickToolbar(nodeId, imageIndex=0){
    return window.SmartCanvasImageEdit?.showImageQuickToolbar?.(nodeId, imageIndex);
}
function engageSmartGroup(groupId, e){ return window.SmartCanvasNodeSelection?.engageSmartGroup?.(groupId, e); }
function showSmartGroupCapsule(groupId){ return window.SmartCanvasNodeSelection?.showSmartGroupCapsule?.(groupId); }
function selectSmartGroup(groupId){ return window.SmartCanvasNodeSelection?.selectSmartGroup?.(groupId); }
function selectCanvasImage(nodeId, imageIndex=0){ return window.SmartCanvasNodeSelection?.selectCanvasImage?.(nodeId, imageIndex); }
function selectCanvasImageFromEvent(event, stopClick=false){ return window.SmartCanvasNodeSelection?.selectCanvasImageFromEvent?.(event, stopClick); }
function syncSelectionUi(){ return window.SmartCanvasNodeSelection?.syncSelectionUi?.(); }
function isNodeSelected(id){ return window.SmartCanvasNodeSelection?.isNodeSelected?.(id); }
function selectedNodeIds(){ return window.SmartCanvasNodeSelection?.selectedNodeIds?.(); }
function isEditableTarget(target){ return window.SmartCanvasNodeSelection?.isEditableTarget?.(target); }
function focusCanvasForShortcuts(){ return window.SmartCanvasNodeSelection?.focusCanvasForShortcuts?.(); }
function safeScale(value){ return window.SmartCanvasMediaLayout?.safeScale?.(value); }
function nodeScale(node){ return window.SmartCanvasMediaLayout?.nodeScale?.(node); }
function mediaNodeDefaultScale(node){ return window.SmartCanvasMediaLayout?.mediaNodeDefaultScale?.(node); }
const MEDIA_NODE_DEFAULT_SCALE = 2.3;
const MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE = 1.6;
const MEDIA_GROUP_DEFAULT_SCALE = 0.8;
const MEDIA_GROUP_THUMB_BASE = 224;
const EMPTY_UPLOAD_NODE_WIDTH = 363;
const EMPTY_UPLOAD_NODE_HEIGHT = 223;
const SMART_GROUP_MAX_VISIBLE_ROWS = 4;
const SMART_GROUP_DEFAULT_WIDTH = 340;
const SMART_GROUP_DEFAULT_HEIGHT = 286;
const SMART_GROUP_LEGACY_HEIGHT = 220;
const SMART_GROUP_MIN_WIDTH = 150;
const SMART_GROUP_MIN_HEIGHT = 130;
const SMART_GROUP_CARD_PADDING = 120;
const SMART_GROUP_ARRANGE_PADDING = SMART_GROUP_CARD_PADDING;
const SMART_GROUP_ARRANGE_GAP = 120;
const SMART_GROUP_THUMB_GAP = 14;
const SMART_GROUP_ARRANGE_HEADER = 0;
const PROMPT_NODE_DEFAULT_WIDTH = 500;
const PROMPT_NODE_DEFAULT_HEIGHT = 308;
const PROMPT_NODE_LEGACY_WIDTHS = new Set([316, 360, 400]);
const PROMPT_NODE_LEGACY_HEIGHTS = new Set([194, 246, 230, 291, 292, 370, 340, 430, 344, 435, 400, 506, 308, 463, 544, 380]);
const PROMPT_NODE_TEXT_DEFAULT_H = 110;
const PROMPT_NODE_TEXT_MIN_H = 48;
const PROMPT_NODE_TEXT_MAX_H = 640;
const PROMPT_LLM_INSTRUCTION_DEFAULT_H = 73;
const PROMPT_LLM_INSTRUCTION_MIN_H = 36;
const PROMPT_LLM_INSTRUCTION_MAX_H = 400;
const PROMPT_SPLIT_RESIZE_BAR_H = 8;
function createImageNodeAt(point, images=[], options={}){ return window.SmartCanvasNodeFactory?.createImageNodeAt?.(point, images, options); }
function singleImageLayout(image, node, scale){ return window.SmartCanvasMediaLayout?.singleImageLayout?.(image, node, scale); }
function groupImageGridLayout(count, explicitW, explicitH, maxThumb, pad=32, gap=8){ return window.SmartCanvasMediaLayout?.groupImageGridLayout?.(count, explicitW, explicitH, maxThumb, pad, gap); }
function smartNodeInputThumbRows(count){ return window.SmartCanvasPromptLayout?.smartNodeInputThumbRows?.(count); }
function smartNodeInputThumbsHeight(images){ return window.SmartCanvasPromptLayout?.smartNodeInputThumbsHeight?.(images); }
function promptNodeInputImages(node){ return window.SmartCanvasPromptLayout?.promptNodeInputImages?.(node); }
function promptNodeInputMediaForLLM(node){ return window.SmartCanvasPromptLayout?.promptNodeInputMediaForLLM?.(node); }
function smartNodeInputThumbsHtml(images, opts={}){ return window.SmartCanvasPromptLayout?.smartNodeInputThumbsHtml?.(images, opts); }
function promptNodeTextHeight(node){ return window.SmartCanvasPromptLayout?.promptNodeTextHeight?.(node); }
function promptNodeContentHeight(node){ return window.SmartCanvasPromptLayout?.promptNodeContentHeight?.(node); }
function syncPromptNodeElementHeights(node, nodeEl=null, options={}){ return window.SmartCanvasPromptLayout?.syncPromptNodeElementHeights?.(node, nodeEl, options); }
function promptNodeExpandedHeight(node){ return window.SmartCanvasPromptLayout?.promptNodeExpandedHeight?.(node); }
function promptNodeLayoutSize(node){ return window.SmartCanvasPromptLayout?.promptNodeLayoutSize?.(node); }
function imageLayout(images, scale=1, node=null){ return window.SmartCanvasMediaLayout?.imageLayout?.(images, scale, node); }
function smartLoopCount(node){ return window.SmartCanvasSmartLoop?.smartLoopCount?.(node); }
function smartLoopWidth(node){ return window.SmartCanvasMediaLayout?.smartLoopWidth?.(node); }
function smartLoopHeight(node){ return window.SmartCanvasMediaLayout?.smartLoopHeight?.(node); }
function fitSmartLoopNode(node){ return window.SmartCanvasPromptLayout?.fitSmartLoopNode?.(node); }
function nodeRect(node){ return window.SmartCanvasMediaLayout?.nodeRect?.(node); }
function applyViewport(options={}){ return window.SmartCanvasViewport?.applyViewport?.(options); }
function worldToScreen(wx, wy){ return window.SmartCanvasViewport?.worldToScreen?.(wx, wy); }
function selectionGroupWorldBounds(){ return window.SmartCanvasSelectionBox?.selectionGroupWorldBounds?.(); }
function hideSelectionGroupBox(){ return window.SmartCanvasSelectionBox?.hideSelectionGroupBox?.(); }
function updateSelectionCapsule(){ return window.SmartCanvasSelectionBox?.updateSelectionCapsule?.(); }
function positionSelectionGroupBox(){ return window.SmartCanvasSelectionBox?.positionSelectionGroupBox?.(); }
function cancelViewportAnimation(){ return window.SmartCanvasViewport?.cancelViewportAnimation?.(); }
function easeOutCubic(t){ return window.SmartCanvasViewport?.easeOutCubic?.(t); }
function animateViewportTo(target, options={}){ return window.SmartCanvasViewport?.animateViewportTo?.(target, options); }
function screenToWorld(event){ return window.SmartCanvasViewport?.screenToWorld?.(event); }
function viewportCenter(){ return window.SmartCanvasViewport?.viewportCenter?.(); }
function renderMinimap(){ return window.SmartCanvasViewport?.renderMinimap?.(); }
function minimapEventToWorld(event){ return window.SmartCanvasViewport?.minimapEventToWorld?.(event); }
function centerViewportOnWorldPoint(point){ return window.SmartCanvasViewport?.centerViewportOnWorldPoint?.(point); }
function getElementWorldRect(el){ return window.SmartCanvasViewport?.getElementWorldRect?.(el); }
function fitViewportToImageWithComposer(node, imageEl){ return window.SmartCanvasViewport?.fitViewportToImageWithComposer?.(node, imageEl); }
function fitAllNodesViewport(){ return window.SmartCanvasViewport?.fitAllNodesViewport?.(); }
function enterZoomPreview(){ return window.SmartCanvasViewport?.enterZoomPreview?.(); }
function exitZoomPreview(point=null){ return window.SmartCanvasViewport?.exitZoomPreview?.(point); }
function toggleZoomPreview(){ return window.SmartCanvasViewport?.toggleZoomPreview?.(); }
const DEFAULT_VIDEO_MODELS = window.SmartCanvasProviderSelection?.DEFAULT_VIDEO_MODELS ?? ['veo3-fast','veo3','sora','runway','kling','pika','minimax-video','wan-v2','seedance-1.0-pro','jimeng-vide-3.0','jimeng-video-3.0-pro'];
function syncApiProvidersFromModule(){
    if(window.SmartCanvasProviders){
        apiProviders = SmartCanvasProviders.getProviders();
        if(window.SmartCanvasModeBindings) SmartCanvasModeBindings.setProviders(apiProviders);
    }
}
if(window.SmartCanvasProviders){
    SmartCanvasProviders.load().then(() => syncApiProvidersFromModule()).catch(err => console.warn('[apiProviders] preload failed', err));
}
function imageProviders(){ return window.SmartCanvasProviderSelection?.imageProviders?.(); }
function chatApiProviders(){ return window.SmartCanvasProviderSelection?.chatApiProviders?.(); }
function resolveChatProviderId(providerId=''){ return window.SmartCanvasProviderSelection?.resolveChatProviderId?.(providerId); }
function providerChatModels(providerId){ return window.SmartCanvasProviderSelection?.providerChatModels?.(providerId); }
function resolveChatModel(model='', providerId=''){ return window.SmartCanvasProviderSelection?.resolveChatModel?.(model, providerId); }
function chatProviderOptions(selectedId=''){ return window.SmartCanvasProviderSelection?.chatProviderOptions?.(selectedId); }
function chatModelOptions(selectedModel='', providerId=''){ return window.SmartCanvasProviderSelection?.chatModelOptions?.(selectedModel, providerId); }
function apiProviderById(providerId){ return window.SmartCanvasProviderSelection?.apiProviderById?.(providerId); }
function providerImageModels(providerId){ return window.SmartCanvasProviderSelection?.providerImageModels?.(providerId); }
function sanitizeSmartApiSelection(target=settings){ return window.SmartCanvasProviderSelection?.sanitizeSmartApiSelection?.(target); }
function videoApiProviders(){ return window.SmartCanvasProviderSelection?.videoApiProviders?.(); }
function videoProviderById(providerId){ return window.SmartCanvasProviderSelection?.videoProviderById?.(providerId); }
function smartVideoGenerationCount(runSettings){ return window.SmartCanvasProviderSelection?.smartVideoGenerationCount?.(runSettings); }
function effectiveApiRunCount(runSettings=settings){ return window.SmartCanvasProviderSelection?.effectiveApiRunCount?.(runSettings); }
function syncVideoCountFromSettings(target=settings){ return window.SmartCanvasProviderSelection?.syncVideoCountFromSettings?.(target); }
function shouldSerializeSmartVideoRequests(runSettings){ return window.SmartCanvasProviderSelection?.shouldSerializeSmartVideoRequests?.(runSettings); }
function providerVideoModels(providerId){ return window.SmartCanvasProviderSelection?.providerVideoModels?.(providerId); }
function ownerVideoProviderForModel(modelName){ return window.SmartCanvasProviderSelection?.ownerVideoProviderForModel?.(modelName); }
function isAgnesVideoHostProvider(provider){ return window.SmartCanvasProviderSelection?.isAgnesVideoHostProvider?.(provider); }
function preferredAgnesVideoProvider(providers){ return window.SmartCanvasProviderSelection?.preferredAgnesVideoProvider?.(providers); }
function normalizeVideoProviderDefaults(providers){ return window.SmartCanvasProviderSelection?.normalizeVideoProviderDefaults?.(providers); }
function ownerImageProviderForModel(modelName){ return window.SmartCanvasProviderSelection?.ownerImageProviderForModel?.(modelName); }
function renderVideoProviderControl(providers){
    return window.SmartCanvasComposerParams.renderVideoProviderControl(providers);
}
function renderVideoModelControl(models){
    return window.SmartCanvasComposerParams.renderVideoModelControl(models);
}
function renderVideoDurationControl(){
    return window.SmartCanvasComposerParams.renderVideoDurationControl();
}
function renderVideoAspectControl(){
    return window.SmartCanvasComposerParams.renderVideoAspectControl();
}
function renderVideoResolutionControl(){
    return window.SmartCanvasComposerParams.renderVideoResolutionControl();
}
function renderVideoToggleControl(key, label){
    return window.SmartCanvasComposerParams.renderVideoToggleControl(key, label);
}
function renderTempShUploadControl(){
    return window.SmartCanvasComposerParams.renderTempShUploadControl();
}
function renderManualVideoUrlControl(){
    return window.SmartCanvasComposerParams.renderManualVideoUrlControl();
}
function renderVideoTrustedAssetControl(){
    return window.SmartCanvasComposerParams.renderVideoTrustedAssetControl();
}
function normalizeApiSizeSettings(prefix=''){
    return window.SmartCanvasComposerParams?.normalizeApiSizeSettings?.(prefix);
}
function updateProviderModels(){ renderDynamicParams(); }
/* --- composer params UI (do not mix with persistence/history) --- */
function controlTypeKey(el){
    return window.SmartCanvasComposerParams?.controlTypeKey?.(el)
        ?? (el ? Array.from(el.classList).find(c => c !== 'smart-control' && c.endsWith('-control')) || '' : '');
}
function openControlState(){
    return window.SmartCanvasComposerParams?.openControlState?.() ?? null;
}
function restoreOpenControl(state){
    window.SmartCanvasComposerParams?.restoreOpenControl?.(state);
}
function dynamicParamsScrollSnapshot(){
    return window.SmartCanvasComposerParams?.dynamicParamsScrollSnapshot?.() ?? null;
}
function restoreDynamicParamsScroll(snapshot){
    window.SmartCanvasComposerParams?.restoreDynamicParamsScroll?.(snapshot);
}
function renderDynamicParams(){
    return window.SmartCanvasComposerParams?.renderDynamicParams?.();
}
function renderComposerHeadParams(){
    return window.SmartCanvasComposerParams?.renderComposerHeadParams?.();
}
function renderApiParams(){
    return window.SmartCanvasComposerParams?.renderApiParams?.();
}
function renderApiVideoParams(){
    return window.SmartCanvasComposerParams?.renderApiVideoParams?.();
}
function renderVolcengineParams(){
    return window.SmartCanvasComposerParams?.renderVolcengineParams?.();
}
function renderVolcengineVideoParams(){
    return window.SmartCanvasComposerParams?.renderVolcengineVideoParams?.();
}
function renderMsParams(){
    return window.SmartCanvasComposerParams?.renderMsParams?.();
}
function renderRunningHubParams(){
    return window.SmartCanvasComposerParams?.renderRunningHubParams?.();
}
function renderComfyParams(){
    return window.SmartCanvasComposerParams.renderComfyParams();
}
function renderRhConfigControl(ref){
    return window.SmartCanvasComposerParams.renderRhConfigControl(ref);
}
function renderRhPaymentControl(){
    return window.SmartCanvasComposerParams.renderRhPaymentControl();
}
function renderRhMachineControl(){
    return window.SmartCanvasComposerParams.renderRhMachineControl();
}
function renderUpscalePill(paramKey, current){
    return window.SmartCanvasComposerParams.renderUpscalePill(paramKey, current);
}
function renderComfyWorkflowControl(){
    return window.SmartCanvasComposerParams.renderComfyWorkflowControl();
}
function renderSizeControls(prefix='', includeSource=false){
    return window.SmartCanvasComposerParams?.renderSizeControls?.(prefix, includeSource) ?? '';
}
function resolutionLabel(prefix=''){
    return window.SmartCanvasComposerParams.resolutionLabel(prefix);
}
function ratioIconClass(value){
    return window.SmartCanvasComposerParams.ratioIconClass(value);
}
function renderRatioControl(prefix='', includeSource=false){
    return window.SmartCanvasComposerParams.renderRatioControl(prefix, includeSource);
}
function renderResolutionControl(prefix=''){
    return window.SmartCanvasComposerParams.renderResolutionControl(prefix);
}
function videoAspectIconClass(value){
    return window.SmartCanvasComposerParams.videoAspectIconClass(value);
}
function renderProviderControl(providers){
    return window.SmartCanvasComposerParams.renderProviderControl(providers);
}
function renderModelControl(models){
    return window.SmartCanvasComposerParams.renderModelControl(models);
}
function msModelLabel(key){
    return window.SmartCanvasComposerParams.msModelLabel(key);
}
function renderMsFunctionControl(){
    return window.SmartCanvasComposerParams.renderMsFunctionControl();
}
function renderMsCustomModelPill(){
    return window.SmartCanvasComposerParams.renderMsCustomModelPill();
}
function sizePickerScope(prefix=''){
    return window.SmartCanvasComposerParams.sizePickerScope(prefix);
}
function sizePickerDefaultResolution(prefix=''){
    return window.SmartCanvasComposerParams.sizePickerDefaultResolution(prefix);
}
function sizePickerLabel(prefix=''){
    return window.SmartCanvasComposerParams.sizePickerLabel(prefix);
}
function renderSizePickerControl(prefix='', includeSource=false){
    return window.SmartCanvasComposerParams.renderSizePickerControl(prefix, includeSource);
}
function renderInlineCustomRatioFields(prefix=''){
    return window.SmartCanvasComposerParams.renderInlineCustomRatioFields(prefix);
}
function renderInlineCustomSizeFields(prefix=''){
    return window.SmartCanvasComposerParams.renderInlineCustomSizeFields(prefix);
}
function renderQualityControl(){
    return window.SmartCanvasComposerParams?.renderQualityControl?.() ?? '';
}
function renderCountVisualControl(){
    return window.SmartCanvasComposerParams?.renderCountVisualControl?.() ?? '';
}
function renderCountControl(){
    return window.SmartCanvasComposerParams?.renderCountControl?.() ?? '';
}
function renderCustomRatioControls(prefix=''){
    return window.SmartCanvasComposerParams.renderCustomRatioControls(prefix);
}
function renderCustomSizeControls(prefix=''){
    return window.SmartCanvasComposerParams.renderCustomSizeControls(prefix);
}
function renderComfySettingField(field){
    return window.SmartCanvasComposerParams.renderComfySettingField(field);
}
/* --- RunningHub params → smart-canvas-runninghub.js --- */
const RH_KNOWN_FIELD_OPTIONS = window.SmartCanvasRunningHub?.RH_KNOWN_FIELD_OPTIONS ?? {};
function rhParamKey(nodeId, fieldName){ return window.SmartCanvasRunningHub?.rhParamKey?.(nodeId, fieldName) ?? `${nodeId ?? ''}::${fieldName ?? ''}`; }
function rhFieldKind(field){ return window.SmartCanvasRunningHub?.rhFieldKind?.(field) ?? 'text'; }
function rhFieldRole(field){ return window.SmartCanvasRunningHub?.rhFieldRole?.(field) ?? 'text'; }
function rhExtractFieldOptions(field){ return window.SmartCanvasRunningHub?.rhExtractFieldOptions?.(field) ?? null; }
function rhDefaultValue(field){ return window.SmartCanvasRunningHub?.rhDefaultValue?.(field) ?? ''; }
function rhIsWorkflowLinkValue(value){ return window.SmartCanvasRunningHub?.rhIsWorkflowLinkValue?.(value) ?? false; }
function rhRandomEnabled(field){ return window.SmartCanvasRunningHub?.rhRandomEnabled?.(field) ?? false; }
function smartRhRandomActive(key){ return window.SmartCanvasRunningHub?.smartRhRandomActive?.(key) ?? true; }
function smartRhRandomActiveFor(sourceSettings=settings, key){ return window.SmartCanvasRunningHub?.smartRhRandomActiveFor?.(sourceSettings, key) ?? true; }
function toggleSmartRhRandom(key){ window.SmartCanvasRunningHub?.toggleSmartRhRandom?.(key); }
function smartRhRandomValue(field){ return window.SmartCanvasRunningHub?.smartRhRandomValue?.(field); }
function rhParamValue(field, media=null, sourceSettings=settings, fields=null, randomValues=smartRhRandomValues){ return window.SmartCanvasRunningHub?.rhParamValue?.(field, media, sourceSettings, fields, randomValues); }
function rhUserParamValue(field){ return window.SmartCanvasRunningHub?.rhUserParamValue?.(field) ?? ''; }
function rhUsableFields(fields){ return window.SmartCanvasRunningHub?.rhUsableFields?.(fields) ?? []; }
function rhWorkflowJsonFromSources(...sources){ return window.SmartCanvasRunningHub?.rhWorkflowJsonFromSources?.(...sources); }
function rhPromptPlaceholder(field){ return window.SmartCanvasRunningHub?.rhPromptPlaceholder?.(field) ?? ''; }
function rhDefaultPromptSuggestion(){ return window.SmartCanvasRunningHub?.rhDefaultPromptSuggestion?.() ?? ''; }
function updatePromptPlaceholder(){ return window.SmartCanvasComposerParams?.updatePromptPlaceholder?.(); }
function rhFieldIndexes(fields){ return window.SmartCanvasRunningHub?.rhFieldIndexes?.(fields) ?? {}; }
async function ensureRunningHubWorkflow(workflowId){ return window.SmartCanvasRunningHub?.ensureRunningHubWorkflow?.(workflowId) ?? null; }
async function currentRunningHubWorkflowConfig(sourceSettings=settings){ return window.SmartCanvasRunningHub?.currentRunningHubWorkflowConfig?.(sourceSettings) ?? null; }
function rhMediaForRun(prompt, refs){ return window.SmartCanvasRunningHub?.rhMediaForRun?.(prompt, refs) ?? {refs:[], image:[], video:[], audio:[], prompt:''}; }
function tempShUploadedUrlFor(url, sourceSettings=settings){ return window.SmartCanvasSmartMediaRefs?.tempShUploadedUrlFor?.(url, sourceSettings); }
function mediaRefSourceUrl(ref){ return window.SmartCanvasSmartMediaRefs?.mediaRefSourceUrl?.(ref); }
function applyUploadedUrlsToSmartRefs(refs, sourceSettings=settings){ return window.SmartCanvasSmartMediaRefs?.applyUploadedUrlsToSmartRefs?.(refs, sourceSettings); }
function normalizeSmartApiRefs(refs, sourceSettings=settings){ return window.SmartCanvasSmartMediaRefs?.normalizeSmartApiRefs?.(refs, sourceSettings); }
function manualSmartVideoLink(sourceSettings=settings){ return window.SmartCanvasSmartMediaRefs?.manualSmartVideoLink?.(sourceSettings); }
function manualSmartMediaLinks(sourceSettings=settings){ return window.SmartCanvasSmartMediaRefs?.manualSmartMediaLinks?.(sourceSettings); }
function renderedInputMediaRefs(){ return window.SmartCanvasSmartMediaRefs?.renderedInputMediaRefs?.(); }
function currentSmartMediaRefs(node){ return window.SmartCanvasSmartMediaRefs?.currentSmartMediaRefs?.(node); }
function currentUploadMediaRefs(node){ return window.SmartCanvasSmartMediaRefs?.currentUploadMediaRefs?.(node); }
function currentSmartMediaLinks(node=null){ return window.SmartCanvasSmartMediaRefs?.currentSmartMediaLinks?.(node); }
function clearManualSmartVideoUrl(){ return window.SmartCanvasSmartMediaRefs?.clearManualSmartVideoUrl?.(); }
function splitManualMediaUrls(text){ return window.SmartCanvasSmartMediaRefs?.splitManualMediaUrls?.(text); }
async function uploadMediaRefToCloud(ref){ return window.SmartCanvasSmartMediaRefs?.uploadMediaRefToCloud?.(ref); }
function applyManualVideoUrlToSmartRef(ref, manualUrl){ return window.SmartCanvasSmartMediaRefs?.applyManualVideoUrlToSmartRef?.(ref, manualUrl); }
async function setCurrentSmartManualVideoUrl(){ return window.SmartCanvasSmartMediaRefs?.setCurrentSmartManualVideoUrl?.(); }
async function uploadCurrentSmartVideosToCloud(){ return window.SmartCanvasSmartMediaRefs?.uploadCurrentSmartVideosToCloud?.(); }
function rhRequiredLabel(field){ return window.SmartCanvasRunningHub?.rhRequiredLabel?.(field) ?? ''; }
function rhPruneWorkflowForMissingFields(workflowJson, missingFields){ return window.SmartCanvasRunningHub?.rhPruneWorkflowForMissingFields?.(workflowJson, missingFields) ?? null; }
async function rhBuildWorkflowRequestExtras(media, nodeInfoList, sourceSettings=settings){ return window.SmartCanvasRunningHub?.rhBuildWorkflowRequestExtras?.(media, nodeInfoList, sourceSettings) ?? {}; }
async function rhUploadValueIfNeeded(value, sourceSettings=settings){ return window.SmartCanvasRunningHub?.rhUploadValueIfNeeded?.(value, sourceSettings) ?? value; }
async function rhBuildNodeInfoList(media, sourceSettings=settings, randomValues=smartRhRandomValues){ return window.SmartCanvasRunningHub?.rhBuildNodeInfoList?.(media, sourceSettings, randomValues) ?? []; }
function renderRhSettingField(field){
    return window.SmartCanvasComposerParams.renderRhSettingField(field);
}
function comfyRandomEnabledField(field){ return window.SmartCanvasComfyParams?.comfyRandomEnabledField?.(field); }
function smartComfyRandomActive(fieldId){ return window.SmartCanvasComfyParams?.smartComfyRandomActive?.(fieldId); }
function smartComfyRandomActiveFor(source, fieldId){ return window.SmartCanvasComfyParams?.smartComfyRandomActiveFor?.(source, fieldId); }
function toggleSmartComfyRandom(fieldId){ return window.SmartCanvasComfyParams?.toggleSmartComfyRandom?.(fieldId); }
function smartComfyRandomValue(field){ return window.SmartCanvasComfyParams?.smartComfyRandomValue?.(field); }
function normalizeSmartVideoModeSettings(target, preferMultimodal=false){ return window.SmartCanvasProviderSelection?.normalizeSmartVideoModeSettings?.(target, preferMultimodal); }
function videoModelCapabilities(modelName=''){ return window.SmartCanvasProviderSelection?.videoModelCapabilities?.(modelName); }
function videoModelOptions(target=settings){ return window.SmartCanvasProviderSelection?.videoModelOptions?.(target); }
function currentVideoReferenceMode(target=settings){ return window.SmartCanvasProviderSelection?.currentVideoReferenceMode?.(target); }
function videoModeUsesSize(target=settings){ return window.SmartCanvasProviderSelection?.videoModeUsesSize?.(target); }
function setDynamicSetting(key, value){
    return window.SmartCanvasComposerParams?.setDynamicSetting?.(key, value);
}
function closeAllSmartPopovers(){
    window.SmartCanvasComposerParams?.closeAllSmartPopovers?.();
}
function bindSmartControlPills(root){
    const fn = window.SmartCanvasComposerParams?.bindSmartControlPills;
    if(typeof fn === 'function') return fn(root);
}
function markControlInteracting(el){
    window.SmartCanvasComposerParams?.markControlInteracting?.(el);
}
function bindDynamicParams(){
    window.SmartCanvasComposerParams?.bindDynamicParams?.();
}
function optionHtml(value, label, selected){ return window.SmartCanvasStringUtils?.optionHtml?.(value, label, selected); }
function parseSizeValue(value){ return window.SmartCanvasComposerSettings?.parseSizeValue?.(value); }
function snapOutputSize(w, h){ return window.SmartCanvasComposerSettings?.snapOutputSize?.(w, h); }
function scaleSizeToLongSide(w, h, longSide){ return window.SmartCanvasComposerSettings?.scaleSizeToLongSide?.(w, h, longSide); }
function resolveImageDimensions(img){ return window.SmartCanvasComposerSettings?.resolveImageDimensions?.(img); }
function sourceReferenceImageCandidates(node, refs=null){ return window.SmartCanvasComposerSettings?.sourceReferenceImageCandidates?.(node, refs); }
function sourceReferenceImageForSize(node, refs=null){ return window.SmartCanvasComposerSettings?.sourceReferenceImageForSize?.(node, refs); }
function ensureImageDimensions(img){ return window.SmartCanvasComposerSettings?.ensureImageDimensions?.(img); }
function sourceReferenceImageForSizeAsync(node, refs=null){ return window.SmartCanvasComposerSettings?.sourceReferenceImageForSizeAsync?.(node, refs); }
function parseRatioValue(value){ return window.SmartCanvasComposerSettings?.parseRatioValue?.(value); }
function apiImageSize(ratioValue, resolutionValue, customRatioValue='', customSizeValue='', sourceImage=null){ return window.SmartCanvasComposerSettings?.apiImageSize?.(ratioValue, resolutionValue, customRatioValue, customSizeValue, sourceImage); }
function ensureComfyWorkflow(name){ return window.SmartCanvasComfyParams?.ensureComfyWorkflow?.(name); }
function currentComfyFields(){ return window.SmartCanvasComfyParams?.currentComfyFields?.(); }
function comfyParamValue(field){ return window.SmartCanvasComfyParams?.comfyParamValue?.(field); }
function ratioLabel(prefix=''){ return window.SmartCanvasComposerSettings?.ratioLabel?.(prefix); }
function gcdInt(a, b){ return window.SmartCanvasComposerSettings?.gcdInt?.(a, b); }
function imageSizeForRatio(img){ return window.SmartCanvasComposerSettings?.imageSizeForRatio?.(img); }
function sourceRatioImageForNode(node){ return window.SmartCanvasComposerSettings?.sourceRatioImageForNode?.(node); }
function reducedRatioForImage(img){ return window.SmartCanvasComposerSettings?.reducedRatioForImage?.(img); }
function sourceImageRatioLabel(prefix=''){ return window.SmartCanvasComposerSettings?.sourceImageRatioLabel?.(prefix); }
function applySourceRatioToSettings(prefix='', node=null, refs=null){ return window.SmartCanvasComposerSettings?.applySourceRatioToSettings?.(prefix, node, refs); }
async function loadConfig(){ return window.SmartCanvasConfigLoader?.loadConfig?.(); }
async function refreshSmartConfigFromSettings(){ return window.SmartCanvasConfigLoader?.refreshSmartConfigFromSettings?.(); }
function loadPromptPresets(){ return window.SmartCanvasPromptTemplates?.loadPromptPresets(); }
function savePromptPresets(){ return window.SmartCanvasPromptTemplates?.savePromptPresets(); }
function defaultPromptTemplateGroups(){ return window.SmartCanvasPromptTemplates?.defaultPromptTemplateGroups(); }
function loadPromptTemplateGroups(){ return window.SmartCanvasPromptTemplates?.loadPromptTemplateGroups(); }
function savePromptTemplateGroups(){ return window.SmartCanvasPromptTemplates?.savePromptTemplateGroups(); }
function loadPromptTemplateOverrides(){ return window.SmartCanvasPromptTemplates?.loadPromptTemplateOverrides(); }
function savePromptTemplateOverrides(){ return window.SmartCanvasPromptTemplates?.savePromptTemplateOverrides(); }
function loadPromptTemplates(){ return window.SmartCanvasPromptTemplates?.loadPromptTemplates(); }
function activePromptLibrary(){ return window.SmartCanvasPromptTemplates?.activePromptLibrary(); }
function renderPromptLibrarySelect(){ return window.SmartCanvasPromptTemplates?.renderPromptLibrarySelect(); }
function promptTemplateItems(){ return window.SmartCanvasPromptTemplates?.promptTemplateItems(); }
function promptTemplateText(template, mode='positive'){ return window.SmartCanvasPromptTemplates?.promptTemplateText(template, mode); }
function promptTemplateName(template){ return window.SmartCanvasPromptTemplates?.promptTemplateName(template); }
function promptTemplateScene(template){ return window.SmartCanvasPromptTemplates?.promptTemplateScene(template); }
function promptTemplateSearchText(template){ return window.SmartCanvasPromptTemplates?.promptTemplateSearchText(template); }
function promptTemplateCategoryLabel(category){ return window.SmartCanvasPromptTemplates?.promptTemplateCategoryLabel(category); }
function promptTemplateSelectedItem(){ return window.SmartCanvasPromptTemplates?.promptTemplateSelectedItem(); }
function currentPromptPreset(id){ return window.SmartCanvasPromptTemplates?.currentPromptPreset(id); }
function defaultPromptPresetName(text){ return window.SmartCanvasPromptTemplates?.defaultPromptPresetName(text); }
function promptPresetPanelNode(){ return window.SmartCanvasPromptTemplates?.promptPresetPanelNode(); }
function setPromptPresetStatus(text='', tone=''){ return window.SmartCanvasPromptTemplates?.setPromptPresetStatus(text, tone); }
function resetPromptPresetDeleteState(){ return window.SmartCanvasPromptTemplates?.resetPromptPresetDeleteState(); }
function createPromptPresetFromNode(node, options={}){ return window.SmartCanvasPromptTemplates?.createPromptPresetFromNode(node, options); }
function createPromptPresetFromComposer(){ return window.SmartCanvasPromptTemplates?.createPromptPresetFromComposer(); }
function savePromptNodeAsPreset(node){ return window.SmartCanvasPromptTemplates?.savePromptNodeAsPreset(node); }
function renderPromptPresetPanel(selectedId='', message=''){ return window.SmartCanvasPromptTemplates?.renderPromptPresetPanel(selectedId, message); }
function openPromptPresetPanel(nodeId='', presetId='', options={}){ return window.SmartCanvasPromptTemplates?.openPromptPresetPanel(nodeId, presetId, options); }
function closePromptPresetPanel(){ return window.SmartCanvasPromptTemplates?.closePromptPresetPanel(); }
function promptTemplateScrollSnapshot(){ return window.SmartCanvasPromptTemplates?.promptTemplateScrollSnapshot(); }
function restorePromptTemplateScroll(snapshot){ return window.SmartCanvasPromptTemplates?.restorePromptTemplateScroll(snapshot); }
function renderPromptTemplatePanel(options={}){ return window.SmartCanvasPromptTemplates?.renderPromptTemplatePanel(options); }
function activePromptTemplateNodeId(){ return window.SmartCanvasPromptTemplates?.activePromptTemplateNodeId(); }
function syncComposerTemplateButton(){ return window.SmartCanvasPromptTemplates?.syncComposerTemplateButton(); }
function openPromptTemplatePanel(nodeId='', templateId='', options={}){ return window.SmartCanvasPromptTemplates?.openPromptTemplatePanel(nodeId, templateId, options); }
function closePromptTemplatePanel(){ return window.SmartCanvasPromptTemplates?.closePromptTemplatePanel(); }
function applyPromptTemplateToNode(mode='positive'){ return window.SmartCanvasPromptTemplates?.applyPromptTemplateToNode(mode); }
function saveCurrentPromptAsTemplate(){ return window.SmartCanvasPromptTemplates?.saveCurrentPromptAsTemplate(); }
function createBlankPromptTemplate(){ return window.SmartCanvasPromptTemplates?.createBlankPromptTemplate(); }
function savePromptTemplateEdit(){ return window.SmartCanvasPromptTemplates?.savePromptTemplateEdit(); }
function deletePromptTemplate(){ return window.SmartCanvasPromptTemplates?.deletePromptTemplate(); }
function createPromptTemplateGroup(){ return window.SmartCanvasPromptTemplates?.createPromptTemplateGroup(); }
function renamePromptTemplateGroup(groupId){ return window.SmartCanvasPromptTemplates?.renamePromptTemplateGroup(groupId); }
function deletePromptTemplateGroup(groupId){ return window.SmartCanvasPromptTemplates?.deletePromptTemplateGroup(groupId); }
function editPromptPresetForNode(node){ return window.SmartCanvasPromptTemplates?.editPromptPresetForNode(node); }
function activePromptTemplateGroups(){ return window.SmartCanvasPromptTemplates?.activePromptTemplateGroups(); }
function assetCategories(type='image'){ return window.SmartCanvasAssetLibrary?.assetCategories(type); }
function assetCategoryById(categoryId=''){ return window.SmartCanvasAssetLibrary?.assetCategoryById(categoryId); }
function assetChildCategories(parentId=''){ return window.SmartCanvasAssetLibrary?.assetChildCategories(parentId); }
function assetCategoryAncestors(categoryId=''){ return window.SmartCanvasAssetLibrary?.assetCategoryAncestors(categoryId); }
function canvasAssetLibraryForCurrentCanvas(){ return window.SmartCanvasAssetLibrary?.canvasAssetLibraryForCurrentCanvas(); }
function syncActiveCanvasAssetLibrary(){ return window.SmartCanvasAssetLibrary?.syncActiveCanvasAssetLibrary(); }
function normalizeActiveAssetCategory(){ return window.SmartCanvasAssetLibrary?.normalizeActiveAssetCategory(); }
function ensureCanvasAssetLibrary(){ return window.SmartCanvasAssetLibrary?.ensureCanvasAssetLibrary(); }
function setAssetGridSize(size='m'){ return window.SmartCanvasAssetLibrary?.setAssetGridSize(size); }
function renderAssetBreadcrumb(){ return window.SmartCanvasAssetLibrary?.renderAssetBreadcrumb(); }
function assetLibraryContainingCategory(categoryId=''){ return window.SmartCanvasAssetLibrary?.assetLibraryContainingCategory(categoryId); }
function mergeCreatedAssetCategory(data){ return window.SmartCanvasAssetLibrary?.mergeCreatedAssetCategory?.(data); }
function bindAssetFolderEvents(){ return window.SmartCanvasAssetLibrary?.bindAssetFolderEvents(); }
function createAssetFolderAt(parentId='', name=''){ return window.SmartCanvasAssetLibrary?.createAssetFolderAt(parentId, name); }
function renameAssetCategory(categoryId, name){ return window.SmartCanvasAssetLibrary?.renameAssetCategory(categoryId, name); }
function deleteAssetCategory(categoryId){ return window.SmartCanvasAssetLibrary?.deleteAssetCategory(categoryId); }
function createAssetFolder(){ return window.SmartCanvasAssetLibrary?.createAssetFolder(); }
function assetLibraries(){ return window.SmartCanvasAssetLibrary?.assetLibraries(); }
function activeAssetLibrary(){ return window.SmartCanvasAssetLibrary?.activeAssetLibrary(); }
function activeAssetCategory(){ return window.SmartCanvasAssetLibrary?.activeAssetCategory(); }
function loadAssetLibrary(){ return window.SmartCanvasAssetLibrary?.loadAssetLibrary(); }
function refreshAssetLibrarySoon(delay=120){ return window.SmartCanvasAssetLibrary?.refreshAssetLibrarySoon(delay); }
function handleAssetLibraryUpdatedMessage(data={}){ return window.SmartCanvasAssetLibrary?.handleAssetLibraryUpdatedMessage(data); }
function connectAssetLibrarySyncSocket(){ return window.SmartCanvasAssetLibrary?.connectAssetLibrarySyncSocket(); }
function setAssetLibraryFromResponse(data, options={}){ return window.SmartCanvasAssetLibrary?.setAssetLibraryFromResponse(data, options); }
function toggleAssetLibrary(open){
    return window.SmartCanvasAssetLibrary?.toggleAssetLibrary?.(open);
}
function assetCategoryForMention(){ return window.SmartCanvasAssetLibrary?.assetCategoryForMention(); }
function assetMediaKind(item){ return window.SmartCanvasAssetLibrary?.assetMediaKind(item); }
function assetThumbHtml(item){ return window.SmartCanvasAssetLibrary?.assetThumbHtml(item); }
function renderAssetGalleryGrid(){ return window.SmartCanvasAssetLibrary?.renderAssetGalleryGrid(); }
function renderAssetLibrary(){ return window.SmartCanvasAssetLibrary?.renderAssetLibrary(); }
function openAssetNameDialog(options={}){ return window.SmartCanvasAssetLibrary?.openAssetNameDialog(options); }
function positionAssetHoverPreview(event){ return window.SmartCanvasAssetLibrary?.positionAssetHoverPreview(event); }
function showAssetHoverPreview(event, item){ return window.SmartCanvasAssetLibrary?.showAssetHoverPreview(event, item); }
function hideAssetHoverPreview(){ return window.SmartCanvasAssetLibrary?.hideAssetHoverPreview(); }
function bindAssetItemEvents(){ return window.SmartCanvasAssetLibrary?.bindAssetItemEvents(); }
function addUrlToAssetLibrary(url, name='', categoryId='', opts={}){ return window.SmartCanvasAssetLibrary?.addUrlToAssetLibrary(url, name, categoryId, opts); }
function canvasImageDragPayload(node, index=0){ return window.SmartCanvasNodeMeta?.canvasImageDragPayload?.(node, index); }
function smartCanvasUrl(id){ return SmartCanvasHistory.smartCanvasUrl(id); }
function setActiveCanvasId(id, opts){ return SmartCanvasHistory.setActiveCanvasId(id, opts); }
async function fetchSmartCanvasRecords(){ return SmartCanvasHistory.fetchSmartCanvasRecords(); }
async function ensureSmartCanvasId(){ return SmartCanvasHistory.ensureSmartCanvasId(); }
async function createNewSmartCanvas(){ return SmartCanvasHistory.createNewSmartCanvas(); }
function collapseCanvasOverlays(){ return window.SmartCanvasOverlayChrome?.collapseCanvasOverlays?.(); }
async function loadCanvas(){ return SmartCanvasPersistence.loadCanvas(); }
function scheduleSave(){ SmartCanvasPersistence.scheduleSave(); }
async function saveCanvas(){ return SmartCanvasPersistence.saveCanvas(); }
function applyMergedServerCanvas(serverCanvas){ return SmartCanvasPersistence.applyMergedServerCanvas(serverCanvas); }
function imageMetaFromNode(node){ return window.SmartCanvasNodeMeta?.imageMetaFromNode?.(node); }
function applyNodeMetaToImage(image, node){ return window.SmartCanvasNodeMeta?.applyNodeMetaToImage?.(image, node); }
function inheritNodeMetaFromImage(node){ return window.SmartCanvasNodeMeta?.inheritNodeMetaFromImage?.(node); }
function createNode(x, y, images=[], options={}){ return window.SmartCanvasNodeFactory?.createNode?.(x, y, images, options); }
function createPromptNode(x, y, options={}){ return window.SmartCanvasNodeFactory?.createPromptNode?.(x, y, options); }
function createLoopNode(x, y, options={}){ return window.SmartCanvasNodeFactory?.createLoopNode?.(x, y, options); }
function cloneSmartNode(node, dx=0, dy=0){ return window.SmartCanvasNodeFactory?.cloneSmartNode?.(node, dx, dy); }
function copySelectedNodes(...args){ return window.SmartCanvasNodeClipboard?.copySelectedNodes?.(...args); }
function pasteNodes(...args){ return window.SmartCanvasNodeClipboard?.pasteNodes?.(...args); }
function duplicateForAltDrag(...args){ return window.SmartCanvasNodeClipboard?.duplicateForAltDrag?.(...args); }
function shellPoint(event){ return window.SmartCanvasOverlayChrome?.shellPoint?.(event); }
function render(...args){
    return window.SmartCanvasNodesRender?.render?.(...args);
}
function renderConnections(...args){
    return window.SmartCanvasNodesRender?.renderConnections?.(...args);
}
function refreshConnectionLayer(...args){
    return window.SmartCanvasNodesRender?.refreshConnectionLayer?.(...args);
}
function moveNodeElementsDuringDrag(...args){
    return window.SmartCanvasNodesRender?.moveNodeElementsDuringDrag?.(...args);
}
function updateNodeElementDuringResize(...args){
    return window.SmartCanvasNodesRender?.updateNodeElementDuringResize?.(...args);
}
function measureSmartNodeImages(...args){
    return window.SmartCanvasNodesRender?.measureSmartNodeImages?.(...args);
}
function bindConnectionEvents(...args){
    return window.SmartCanvasNodesRender?.bindConnectionEvents?.(...args);
}
function refreshRunTimerPills(...args){
    return window.SmartCanvasNodesRender?.refreshRunTimerPills?.(...args);
}
function hideRunTimerForNode(...args){
    return window.SmartCanvasNodesRender?.hideRunTimerForNode?.(...args);
}
function smartNodeHasLiveMedia(...args){
    return window.SmartCanvasNodesRender?.smartNodeHasLiveMedia?.(...args);
}
function mediaSignaturePartFromElement(...args){
    return window.SmartCanvasNodesRender?.mediaSignaturePartFromElement?.(...args);
}
function captureMediaPlaybackState(...args){
    return window.SmartCanvasNodesRender?.captureMediaPlaybackState?.(...args);
}
function restoreMediaPlaybackState(...args){
    return window.SmartCanvasNodesRender?.restoreMediaPlaybackState?.(...args);
}
function transplantSmartMediaElements(...args){
    return window.SmartCanvasNodesRender?.transplantSmartMediaElements?.(...args);
}
function captureMediaPlaybackStates(...args){
    return window.SmartCanvasNodesRender?.captureMediaPlaybackStates?.(...args);
}
function restoreMediaPlaybackStates(...args){
    return window.SmartCanvasNodesRender?.restoreMediaPlaybackStates?.(...args);
}
function formatRunDuration(...args){
    return window.SmartCanvasNodesRender?.formatRunDuration?.(...args);
}
function nodeRunElapsedMs(...args){
    return window.SmartCanvasNodesRender?.nodeRunElapsedMs?.(...args);
}
function runTimePillHtml(...args){
    return window.SmartCanvasNodesRender?.runTimePillHtml?.(...args);
}
/* === end nodes-render wrappers === */

function isVideoMediaItem(img){ return window.SmartCanvasMediaLayout?.isVideoMediaItem?.(img); }
function isAudioMediaItem(img){ return window.SmartCanvasMediaLayout?.isAudioMediaItem?.(img); }
function isTextMediaItem(img){ return window.SmartCanvasMediaLayout?.isTextMediaItem?.(img); }
function isFileMediaItem(img){ return window.SmartCanvasMediaLayout?.isFileMediaItem?.(img); }
function mediaKindForFile(file){ return window.SmartCanvasMediaLayout?.mediaKindForFile?.(file); }
function mediaKindForItem(img){ return window.SmartCanvasMediaLayout?.mediaKindForItem?.(img); }
function localDisplayUrlForMediaItem(img){ return window.SmartCanvasMediaLayout?.localDisplayUrlForMediaItem?.(img); }
function imageForDisplay(img){ return window.SmartCanvasMediaLayout?.imageForDisplay?.(img); }
function resultMediaUrls(result){ return window.SmartCanvasMediaLayout?.resultMediaUrls?.(result); }
function mediaKindForUrls(urls, fallback='image'){ return window.SmartCanvasMediaLayout?.mediaKindForUrls?.(urls, fallback); }
function imageRefsOnly(refs){ return window.SmartCanvasSmartMediaRefs?.imageRefsOnly?.(refs); }
function looksLikeImageMediaUrl(url){ return window.SmartCanvasSmartMediaRefs?.looksLikeImageMediaUrl?.(url); }
function videoRefsOnly(refs){ return window.SmartCanvasSmartMediaRefs?.videoRefsOnly?.(refs); }
function isRemoteVideoReferenceUrl(url){ return window.SmartCanvasSmartMediaRefs?.isRemoteVideoReferenceUrl?.(url); }
function audioRefsOnly(refs){ return window.SmartCanvasSmartMediaRefs?.audioRefsOnly?.(refs); }
function thumbMediaHtml(img){ return window.SmartCanvasMediaLayout?.thumbMediaHtml?.(img); }
function imageResolutionLabel(img){ return window.SmartCanvasMediaLayout?.imageResolutionLabel?.(img); }
function imageResolutionBadgeHtml(img){ return window.SmartCanvasMediaLayout?.imageResolutionBadgeHtml?.(img); }
function thumbDisplaySize(img, maxSize){ return window.SmartCanvasMediaLayout?.thumbDisplaySize?.(img, maxSize); }
function thumbItemStyle(img, maxSize){ return window.SmartCanvasMediaLayout?.thumbItemStyle?.(img, maxSize); }
function applyThumbDisplaySizeToElement(itemEl, img, maxSize=0){ return window.SmartCanvasMediaLayout?.applyThumbDisplaySizeToElement?.(itemEl, img, maxSize); }
function singleMediaHtml(img, w, h){ return window.SmartCanvasMediaLayout?.singleMediaHtml?.(img, w, h); }
function smartRunTaskLabel(run){ return window.SmartCanvasGenerationLog?.smartRunTaskLabel?.(run); }
function outputUrlLooksVideo(url){ return window.SmartCanvasMediaLayout?.outputUrlLooksVideo?.(url); }
function proxiedMediaUrl(itemOrUrl, name=''){ return window.SmartCanvasMediaLayout?.proxiedMediaUrl?.(itemOrUrl, name); }
function displayMediaUrl(itemOrUrl, name=''){ return window.SmartCanvasMediaLayout?.displayMediaUrl?.(itemOrUrl, name); }
function bindImageProxyFallback(imgEl, itemOrUrl){ return window.SmartCanvasMediaLayout?.bindImageProxyFallback?.(imgEl, itemOrUrl); }
function safeExportFileName(name, fallback='download.zip'){ return window.SmartCanvasMediaDownload?.safeExportFileName?.(name, fallback); }
function fileNameFromUrl(url=''){ return window.SmartCanvasMediaLayout?.fileNameFromUrl?.(url); }
function extensionForMediaItem(item, fallback='.png'){ return window.SmartCanvasMediaDownload?.extensionForMediaItem?.(item, fallback); }
function downloadNameForMediaItem(item, fallbackPrefix='canvas-output'){ return window.SmartCanvasMediaDownload?.downloadNameForMediaItem?.(item, fallbackPrefix); }
function downloadPreviewImage(){ return window.SmartCanvasMediaDownload?.downloadPreviewImage?.(); }
function downloadPreviewFile(item){
    return window.SmartCanvasImagePreview?.downloadPreviewFile?.(item);
}
function downloadNodeImage(nodeId, imageIndex=0){ return window.SmartCanvasMediaDownload?.downloadNodeImage?.(nodeId, imageIndex); }
function saveNodeImageAs(nodeId, imageIndex=0){ return window.SmartCanvasMediaDownload?.saveNodeImageAs?.(nodeId, imageIndex); }
function previewDownloadGroupItems(){ return window.SmartCanvasMediaDownload?.previewDownloadGroupItems?.(); }
async function downloadPreviewGroup(){ return window.SmartCanvasMediaDownload?.downloadPreviewGroup?.(); }
function smartRunPlatformLabel(run){ return window.SmartCanvasGenerationLog?.smartRunPlatformLabel?.(run); }
function smartRunRequestMeta(run){ return window.SmartCanvasGenerationLog?.smartRunRequestMeta?.(run); }
function smartRunSnapshot(node, prompt, refs=[], kind='image'){ return window.SmartCanvasGenerationLog?.smartRunSnapshot?.(node, prompt, refs, kind); }
function addSmartGenerationLog(...args){ return window.SmartCanvasGenerationLog?.addSmartGenerationLog?.(...args); }
function smartLogPreviewNode(url, kind='image'){ return window.SmartCanvasGenerationLog?.smartLogPreviewNode?.(url, kind); }
function renderSmartCanvasLog(){ return window.SmartCanvasGenerationLog?.renderSmartCanvasLog?.(); }
function openSmartCanvasLog(){ return window.SmartCanvasGenerationLog?.openSmartCanvasLog?.(); }
function closeSmartCanvasLog(){ return window.SmartCanvasGenerationLog?.closeSmartCanvasLog?.(); }
function openSmartCanvasShortcuts(){
    smartShortcutModal?.classList.add('open');
    refreshIcons();
}
function closeSmartCanvasShortcuts(){
    smartShortcutModal?.classList.remove('open');
    smartShortcutModal?.classList.remove('shortcut-modal--bottom-left');
}
/* === D2b node-body wrappers === */
function promptNodeBodyHtml(...args){
    return window.SmartCanvasNodesRender?.promptNodeBodyHtml?.(...args);
}
function smartLoopBodyHtml(...args){
    return window.SmartCanvasNodesRender?.smartLoopBodyHtml?.(...args);
}
function nodeBodyHtml(...args){
    return window.SmartCanvasNodesRender?.nodeBodyHtml?.(...args);
}
function loopNumberControlHtml(...args){
    return window.SmartCanvasNodesRender?.loopNumberControlHtml?.(...args);
}
function smartLoopTokenLabel(...args){
    return window.SmartCanvasNodesRender?.smartLoopTokenLabel?.(...args);
}
function smartLoopTokenChipHtml(...args){
    return window.SmartCanvasNodesRender?.smartLoopTokenChipHtml?.(...args);
}
function smartLoopVariableHtml(...args){
    return window.SmartCanvasNodesRender?.smartLoopVariableHtml?.(...args);
}
function smartLoopEditorText(...args){
    return window.SmartCanvasNodesRender?.smartLoopEditorText?.(...args);
}
function insertSmartLoopToken(...args){
    return window.SmartCanvasNodesRender?.insertSmartLoopToken?.(...args);
}
/* === end D2b wrappers === */

function nowMs(){ return Date.now(); }
/* === DOMAIN: node-events → smart-canvas-node-events.js (wrappers below) === */
/* === D4 node-events wrappers === */
function ensurePortDragPathElement(...args){
    return window.SmartCanvasNodeEvents?.ensurePortDragPathElement?.(...args);
}
function clearPortDragVisual(...args){
    return window.SmartCanvasNodeEvents?.clearPortDragVisual?.(...args);
}
function bindPromptNodeControls(...args){
    return window.SmartCanvasNodeEvents?.bindPromptNodeControls?.(...args);
}
function bindLoopNodeControls(...args){
    return window.SmartCanvasNodeEvents?.bindLoopNodeControls?.(...args);
}
function bindScrollableText(...args){
    return window.SmartCanvasNodeEvents?.bindScrollableText?.(...args);
}
function updatePortDragVisual(...args){
    return window.SmartCanvasNodeEvents?.updatePortDragVisual?.(...args);
}
function handlePortDrop(...args){
    return window.SmartCanvasNodeEvents?.handlePortDrop?.(...args);
}
function pickMediaForSmartNode(...args){
    return window.SmartCanvasNodeEvents?.pickMediaForSmartNode?.(...args);
}
function queueSmartNodeDrag(...args){
    return window.SmartCanvasNodeEvents?.queueSmartNodeDrag?.(...args);
}
function bindNodeEvents(...args){
    return window.SmartCanvasNodeEvents?.bindNodeEvents?.(...args);
}
function rectOverlapNode(...args){
    return window.SmartCanvasNodeEvents?.rectOverlapNode?.(...args);
}
function dragConnectTargetFor(...args){
    return window.SmartCanvasNodeEvents?.dragConnectTargetFor?.(...args);
}
function canAutoConnectDraggedNode(...args){
    return window.SmartCanvasNodeEvents?.canAutoConnectDraggedNode?.(...args);
}
function restoreDraggedNodePosition(...args){
    return window.SmartCanvasNodeEvents?.restoreDraggedNodePosition?.(...args);
}
function clearDropHighlight(...args){
    return window.SmartCanvasNodeEvents?.clearDropHighlight?.(...args);
}
function setDropHighlight(...args){
    return window.SmartCanvasNodeEvents?.setDropHighlight?.(...args);
}
/* === end D4 node-events wrappers === */

function deleteNode(id){ return window.SmartCanvasNodeDelete?.deleteNode?.(id); }
function clearNodeMediaBeforeDelete(id){ return window.SmartCanvasNodeDelete?.clearNodeMediaBeforeDelete?.(id); }
function deleteNodeFromButton(id){ return window.SmartCanvasNodeDelete?.deleteNodeFromButton?.(id); }
function disconnectConnection(index){ return window.SmartCanvasConnectionGraph?.disconnectConnection?.(index); }
function connectionMidpoint(conn){ return window.SmartCanvasConnectionGraph?.connectionMidpoint?.(conn); }
function insertionConnectionForNode(node){ return window.SmartCanvasConnectionGraph?.insertionConnectionForNode?.(node); }
function insertLoopNodeIntoConnection(loopNode, hit){ return window.SmartCanvasConnectionGraph?.insertLoopNodeIntoConnection?.(loopNode, hit); }
function updateLoopInsertPreview(){ return window.SmartCanvasConnectionGraph?.updateLoopInsertPreview?.(); }
function deleteImage(id, imageIndex){ return window.SmartCanvasNodeDelete?.deleteImage?.(id, imageIndex); }
function currentEditImage(){ return window.SmartCanvasImageEdit?.currentEditImage?.(); }
function cropImageDisplaySize(){
    return window.SmartCanvasImageEdit?.cropImageDisplaySize?.() || {w:1, h:1};
}
function cropBounds(){ return window.SmartCanvasImageEdit?.cropBounds?.(); }
function cutoutTolerance(){ return window.SmartCanvasImageEdit?.cutoutTolerance?.() ?? 0; }
function cutoutSourcePixels(){ return window.SmartCanvasImageEdit?.cutoutSourcePixels?.() ?? null; }
function renderCutoutSelection(){ window.SmartCanvasImageEdit?.renderCutoutSelection?.(); }
function pushCutoutHistory(){ /* internal to image-edit */ }
function undoCutoutSelection(){ window.SmartCanvasImageEdit?.undoCutoutSelection?.(); }
function selectCutoutAt(point, additive=false, recordHistory=true){ window.SmartCanvasImageEdit?.selectCutoutAt?.(point, additive, recordHistory); }
function refreshCutoutFromControls(){ window.SmartCanvasImageEdit?.refreshCutoutFromControls?.(); }
function invertCutoutSelection(){ window.SmartCanvasImageEdit?.invertCutoutSelection?.(); }
function clearCutoutSelection(silent=false){ window.SmartCanvasImageEdit?.clearCutoutSelection?.(silent); }
function editDrawCanvas(){ return window.SmartCanvasImageDraw?.editDrawCanvas(); }
function editTextCanvas(){ return window.SmartCanvasImageDraw?.editTextCanvas(); }
function editTextContext(){ return window.SmartCanvasImageDraw?.editTextContext(); }
function selectedEditTextItem(){ return window.SmartCanvasImageDraw?.selectedEditTextItem(); }
function defaultEditTextText(){ return window.SmartCanvasImageDraw?.defaultEditTextText(); }
function editTextSizeFromBrush(){ return window.SmartCanvasImageDraw?.editTextSizeFromBrush(); }
function createEditTextItem(text, point, preset={}){ return window.SmartCanvasImageDraw?.createEditTextItem(text, point, preset); }
function textItemFont(item){ return window.SmartCanvasImageDraw?.textItemFont(item); }
function measureEditTextItem(item, ctx){ return window.SmartCanvasImageDraw?.measureEditTextItem(item, ctx); }
function hitEditTextItem(point){ return window.SmartCanvasImageDraw?.hitEditTextItem(point); }
function renderEditTextCanvas(){ return window.SmartCanvasImageDraw?.renderEditTextCanvas(); }
function syncTextToolState(force=false){ return window.SmartCanvasImageDraw?.syncTextToolState(force); }
function syncSelectedEditTextStyleFromBrush(){ return window.SmartCanvasImageDraw?.syncSelectedEditTextStyleFromBrush(); }
function beginTextEditChange(){ return window.SmartCanvasImageDraw?.beginTextEditChange(); }
function setSelectedEditTextItem(id){ return window.SmartCanvasImageDraw?.setSelectedEditTextItem(id); }
function confirmSelectedEditTextItem(){ return window.SmartCanvasImageDraw?.confirmSelectedEditTextItem(); }
function editTextCanvasScale(){ return window.SmartCanvasImageDraw?.editTextCanvasScale(); }
function selectInlineEditorText(el){ return window.SmartCanvasImageDraw?.selectInlineEditorText(el); }
function inlineEditorText(){ return window.SmartCanvasImageDraw?.inlineEditorText(); }
function autosizeEditTextInlineEditor(){ return window.SmartCanvasImageDraw?.autosizeEditTextInlineEditor(); }
function positionEditTextInlineEditor(){ return window.SmartCanvasImageDraw?.positionEditTextInlineEditor(); }
function removeEditTextInlineEditor(commit=true){ return window.SmartCanvasImageDraw?.removeEditTextInlineEditor(commit); }
function beginEditTextInline(item){ return window.SmartCanvasImageDraw?.beginEditTextInline(item); }
function editTextPoint(event){ return window.SmartCanvasImageDraw?.editTextPoint(event); }
function beginEditText(event){ return window.SmartCanvasImageDraw?.beginEditText(event); }
function updateEditTextCursor(event){ return window.SmartCanvasImageDraw?.updateEditTextCursor(event); }
function moveEditText(event){ return window.SmartCanvasImageDraw?.moveEditText(event); }
function endEditText(event){ return window.SmartCanvasImageDraw?.endEditText(event); }
function editTextHasContent(){ return window.SmartCanvasImageDraw?.editTextHasContent(); }
function resizeEditTextCanvas(){ return window.SmartCanvasImageDraw?.resizeEditTextCanvas(); }
function resizeEditDrawCanvas(){ return window.SmartCanvasImageDraw?.resizeEditDrawCanvas(); }
function editDrawSnapshot(){ return window.SmartCanvasImageDraw?.editDrawSnapshot(); }
function restoreEditDrawSnapshot(snapshot){ return window.SmartCanvasImageDraw?.restoreEditDrawSnapshot(snapshot); }
function pushEditDrawHistory(){ return window.SmartCanvasImageDraw?.pushEditDrawHistory(); }
function syncEditDrawingHistoryButtons(){ return window.SmartCanvasImageDraw?.syncEditDrawingHistoryButtons(); }
function undoEditDrawing(){ return window.SmartCanvasImageDraw?.undoEditDrawing(); }
function redoEditDrawing(){ return window.SmartCanvasImageDraw?.redoEditDrawing(); }
function editCanvasHasPixels(){ return window.SmartCanvasImageDraw?.editCanvasHasPixels(); }
function clearEditDrawing(silent=false){ return window.SmartCanvasImageDraw?.clearEditDrawing(silent); }
function resetEditDrawingHistory(){ return window.SmartCanvasImageDraw?.resetEditDrawingHistory(); }
function setBrushTool(tool){ return window.SmartCanvasImageDraw?.setBrushTool(tool); }
function syncBrushToolButtons(){ return window.SmartCanvasImageDraw?.syncBrushToolButtons(); }
function editDrawPoint(event){ return window.SmartCanvasImageDraw?.editDrawPoint(event); }
function gridCustomLineHit(point){ return window.SmartCanvasImageDraw?.gridCustomLineHit(point); }
function setGridCustomLinePos(index, point){ return window.SmartCanvasImageDraw?.setGridCustomLinePos(index, point); }
function editBrushSize(){ return window.SmartCanvasImageDraw?.editBrushSize(); }
function brushColor(){ return window.SmartCanvasImageDraw?.brushColor(); }
function setupDrawStyle(ctx){ return window.SmartCanvasImageDraw?.setupDrawStyle(ctx); }
function normalizeMaskPreviewCanvas(canvasEl=editDrawCanvas()){ return window.SmartCanvasImageDraw?.normalizeMaskPreviewCanvas(canvasEl); }
function strokeFreeDrawPoint(point){ return window.SmartCanvasImageDraw?.strokeFreeDrawPoint(point); }
function circledNumber(n){ return window.SmartCanvasImageDraw?.circledNumber(n); }
function drawBrushShape(ctx, start, end){ return window.SmartCanvasImageDraw?.drawBrushShape(ctx, start, end); }
function drawNumberLabel(point){ return window.SmartCanvasImageDraw?.drawNumberLabel(point); }
function beginEditDraw(event){ return window.SmartCanvasImageDraw?.beginEditDraw(event); }
function moveEditDraw(event){ return window.SmartCanvasImageDraw?.moveEditDraw(event); }
function endEditDraw(event){ return window.SmartCanvasImageDraw?.endEditDraw(event); }
function setImageEditMode(mode, userTouched=false){
    return window.SmartCanvasImageEdit?.setImageEditMode?.(mode, userTouched);
}
let previewCompareOn = false;
let previewCompareIndex = -1;
let previewMetaExtraText = '';
function applyPreviewTransform(){
    return window.SmartCanvasImagePreview?.applyPreviewTransform?.();
}
function resetPreviewTransform(){
    return window.SmartCanvasImagePreview?.resetPreviewTransform?.();
}
function panoramaRatioValue(){
    return window.SmartCanvasImagePreview?.panoramaRatioValue?.() || {w:16, h:9};
}
function panoramaResolutionValue(){
    return window.SmartCanvasImagePreview?.panoramaResolutionValue?.() || {w:1536, h:864};
}
function panoramaSource(){
    return window.SmartCanvasImagePreview?.panoramaSource?.() || '';
}
function panoramaFallbackSource(){
    return window.SmartCanvasImagePreview?.panoramaFallbackSource?.() || '';
}
function isLikelyPanoramaImage(node, image, naturalW=0, naturalH=0){
    return window.SmartCanvasImagePreview?.isLikelyPanoramaImage?.(node, image, naturalW, naturalH);
}
async function ensurePanoramaRenderer(){
    return window.SmartCanvasImagePreview?.ensurePanoramaRenderer?.();
}
function applyPanoramaTexture(img){
    return window.SmartCanvasImagePreview?.applyPanoramaTexture?.(img);
}
function drawPanoramaFrame(){
    return window.SmartCanvasImagePreview?.drawPanoramaFrame?.();
}
function renderPanoramaFrame(){
    return window.SmartCanvasImagePreview?.renderPanoramaFrame?.();
}
function startPanoramaLoop(){
    return window.SmartCanvasImagePreview?.startPanoramaLoop?.();
}
function stopPanoramaLoop(){
    return window.SmartCanvasImagePreview?.stopPanoramaLoop?.();
}
function resizePanoramaViewer(){
    return window.SmartCanvasImagePreview?.resizePanoramaViewer?.();
}
function disposePanoramaTexture(){
    return window.SmartCanvasImagePreview?.disposePanoramaTexture?.();
}
async function loadPanoramaTexture(src, allowFallback=true){
    return window.SmartCanvasImagePreview?.loadPanoramaTexture?.(src, allowFallback);
}
function refreshPanoramaControls(){
    return window.SmartCanvasImagePreview?.refreshPanoramaControls?.();
}
function setPanoramaEnabled(enabled){
    return window.SmartCanvasImagePreview?.setPanoramaEnabled?.(enabled);
}
function togglePanoramaPreview(){
    return window.SmartCanvasImagePreview?.togglePanoramaPreview?.();
}
async function exportPanoramaFrame(){
    return window.SmartCanvasImagePreview?.exportPanoramaFrame?.();
}
function resetPanoramaView(){
    return window.SmartCanvasImagePreview?.resetPanoramaView?.();
}
function disposePanoramaPreview(){
    return window.SmartCanvasImagePreview?.disposePanoramaPreview?.();
}
function applyPanoramaRatio(value){
    return window.SmartCanvasImagePreview?.applyPanoramaRatio?.(value);
}
function setPreviewComparePos(clientX){
    return window.SmartCanvasImagePreview?.setPreviewComparePos?.(clientX);
}
function syncPreviewFrameSize(){
    return window.SmartCanvasImagePreview?.syncPreviewFrameSize?.();
}
function previewResolutionText(){
    return window.SmartCanvasImagePreview?.previewResolutionText?.() || '';
}
function updatePreviewMetaHint(extraText=previewMetaExtraText){
    return window.SmartCanvasImagePreview?.updatePreviewMetaHint?.(extraText);
}
function rememberPreviewImageResolution(){
    return window.SmartCanvasImagePreview?.rememberPreviewImageResolution?.();
}
function previewCompareSources(){
    return window.SmartCanvasImagePreview?.previewCompareSources?.() || [];
}
function refreshComparePanel(){
    return window.SmartCanvasImagePreview?.refreshComparePanel?.();
}
function togglePreviewCompare(){
    return window.SmartCanvasImagePreview?.togglePreviewCompare?.();
}
function currentPreviewVideo(){
    return window.SmartCanvasImagePreview?.currentPreviewVideo?.() || null;
}
function videoFrameStep(){
    return window.SmartCanvasImagePreview?.videoFrameStep?.() || (1 / 30);
}
function seekPreviewVideoFrames(direction){
    return window.SmartCanvasImagePreview?.seekPreviewVideoFrames?.(direction);
}
function waitForVideoEvent(video, eventName, timeout=1500){
    return window.SmartCanvasImagePreview?.waitForVideoEvent?.(video, eventName, timeout);
}
async function seekVideoForFrame(video, time){
    return window.SmartCanvasImagePreview?.seekVideoForFrame?.(video, time);
}
async function exportVideoFrame(which='current'){
    return window.SmartCanvasImagePreview?.exportVideoFrame?.(which);
}
function syncGridGapValue(){ return window.SmartCanvasImageEdit?.syncGridGapValue?.(); }
function gridSplitSettings(){ return window.SmartCanvasImageEdit?.gridSplitSettings?.(); }
function gridSplitRects(width, height){ return window.SmartCanvasImageEdit?.gridSplitRects?.(width, height); }
function gridSplitRectsCustom(width, height){ return window.SmartCanvasImageEdit?.gridSplitRectsCustom?.(width, height); }
function gridLayoutFromRects(rects){ return window.SmartCanvasImageEdit?.gridLayoutFromRects?.(rects); }
function applyGridPreset(rows, cols){ return window.SmartCanvasImageEdit?.applyGridPreset?.(rows, cols); }
function syncGridCustomControls(){ return window.SmartCanvasImageEdit?.syncGridCustomControls?.(); }
function toggleGridCustomMode(){ return window.SmartCanvasImageEdit?.toggleGridCustomMode?.(); }
function setGridCustomOrientation(orient){ return window.SmartCanvasImageEdit?.setGridCustomOrientation?.(orient); }
function clearGridCustomLines(){ return window.SmartCanvasImageEdit?.clearGridCustomLines?.(); }
function undoGridCustomLine(){ return window.SmartCanvasImageEdit?.undoGridCustomLine?.(); }
function syncGridCustomUndoBtn(){ return window.SmartCanvasImageEdit?.syncGridCustomUndoBtn?.(); }
function applyImageEditZoom(scaleOverride=null){
    return window.SmartCanvasImageEdit?.applyImageEditZoom?.(scaleOverride);
}
function ensureImageEditBaseSize(force=false){
    return window.SmartCanvasImageEdit?.ensureImageEditBaseSize?.(force);
}
function syncImageEditOverflow(){
    return window.SmartCanvasImageEdit?.syncImageEditOverflow?.();
}
function resetImageEditZoom(){
    return window.SmartCanvasImageEdit?.resetImageEditZoom?.();
}
function updateZoomLabel(){
    return window.SmartCanvasImageEdit?.updateZoomLabel?.();
}
function syncGridCustomCursor(){
    return window.SmartCanvasImageEdit?.syncGridCustomCursor?.();
}
function refreshGridSplitPreview(){
    return window.SmartCanvasImageEdit?.refreshGridSplitPreview?.();
}
function renderCropBox(){
    return window.SmartCanvasImageEdit?.renderCropBox?.();
}
function outpaintNaturalSize(){
    const img = document.getElementById('cropImage');
    if(!img || !cropState) return {w:1, h:1};
    const display = cropImageDisplaySize();
    const scaleX = Math.max(1, Number(img.naturalWidth || 1)) / Math.max(1, Number(display.w || img.clientWidth || 1));
    const scaleY = Math.max(1, Number(img.naturalHeight || 1)) / Math.max(1, Number(display.h || img.clientHeight || 1));
    return {
        w:Math.max(1, Math.round((cropState.w || 1) * scaleX)),
        h:Math.max(1, Math.round((cropState.h || 1) * scaleY))
    };
}
function updateOutpaintResolutionLabel(){
    return window.SmartCanvasImageEdit?.updateOutpaintResolutionLabel?.();
}
function clampOutpaint(){
    return window.SmartCanvasImageEdit?.clampOutpaint?.();
}
function resetOutpaintBox(){
    return window.SmartCanvasImageEdit?.resetOutpaintBox?.();
}
function resetCropBox(){
    return window.SmartCanvasImageEdit?.resetCropBox?.();
}
function updatePreviewNavButtons(){
    return window.SmartCanvasImageEdit?.updatePreviewNavButtons?.();
}
function navigatePreviewImage(delta){
    return window.SmartCanvasImageEdit?.navigatePreviewImage?.(delta);
}
function openImagePreview(nodeId, imageIndex=0){
    return window.SmartCanvasImageEdit?.openImagePreview?.(nodeId, imageIndex);
}
function imageQuickActionMeta(action){
    return window.SmartCanvasImageEdit?.imageQuickActionMeta?.(action) || {title:'图片工具', sub:'处理当前选中的图片。', panel:'default-panel'};
}
function setImageEditorContext(action=''){
    return window.SmartCanvasImageEdit?.setImageEditorContext?.(action);
}
function openImageQuickAction(action, nodeId=selectedImage.nodeId, imageIndex=selectedImage.index){
    return window.SmartCanvasImageEdit?.openImageQuickAction?.(action, nodeId, imageIndex);
}
function openImageEditor(nodeId, imageIndex=0){
    return window.SmartCanvasImageEdit?.openImageEditor?.(nodeId, imageIndex);
}
function closeImageEditor(){
    return window.SmartCanvasImageEdit?.closeImageEditor?.();
}
function clampCrop(){
    return window.SmartCanvasImageEdit?.clampCrop?.();
}
function beginCropDrag(event, mode){
    return window.SmartCanvasImageEdit?.beginCropDrag?.(event, mode);
}
function resizeOutpaintFromDrag(dx, dy){
    return window.SmartCanvasImageEdit?.resizeOutpaintFromDrag?.(dx, dy);
}
function applyCropDragMove(event){
    return window.SmartCanvasImageEdit?.applyCropDragMove?.(event);
}
function endCropDrag(){
    return window.SmartCanvasImageEdit?.endCropDrag?.();
}
async function uploadCroppedBlob(blob, name){
    return window.SmartCanvasImageEdit?.uploadCroppedBlob?.(blob, name);
}
async function uploadImageBlobs(blobs){
    return window.SmartCanvasImageEdit?.uploadImageBlobs?.(blobs);
}
function replaceEditedImage(file){
    return window.SmartCanvasImageEdit?.replaceEditedImage?.(file);
}
function applyOutpaintSizeToSmartParams(width, height){ return window.SmartCanvasImageEdit?.applyOutpaintSizeToSmartParams?.(width, height); }
async function applyImageCrop(){
    return window.SmartCanvasImageEdit?.applyImageCrop?.();
}
async function applyImageOutpaint(){
    return window.SmartCanvasImageEdit?.applyImageOutpaint?.();
}
async function applyImageMask(){
    return window.SmartCanvasImageEdit?.applyImageMask?.();
}
function maskCanvasFromDrawCanvas(src){
    return window.SmartCanvasImageEdit?.maskCanvasFromDrawCanvas?.(src);
}
async function applyImageBrush(){
    return window.SmartCanvasImageEdit?.applyImageBrush?.();
}
async function applyImageCutout(){
    return window.SmartCanvasImageEdit?.applyImageCutout?.();
}
async function applyImageGridSplit(){
    return window.SmartCanvasImageEdit?.applyImageGridSplit?.();
}
function applyImageEdit(){
    return window.SmartCanvasImageEdit?.applyImageEdit?.();
}
function currentComposerSubject(){ return window.SmartCanvasPromptDraft?.currentComposerSubject?.(); }
function savePromptDraftForCurrent(){ return window.SmartCanvasPromptDraft?.savePromptDraftForCurrent?.(); }
function setPromptDraftForNode(node, text){ return window.SmartCanvasPromptDraft?.setPromptDraftForNode?.(node, text); }
function loadPromptDraft(subject){ return window.SmartCanvasPromptDraft?.loadPromptDraft?.(subject); }
function positionComposerForNode(node){ return SmartCanvasComposer.positionComposerForNode(node); }
function scheduleComposerReposition(node){ return SmartCanvasComposer.scheduleComposerReposition(node); }
function updateComposer(){ return SmartCanvasComposer.updateComposer(); }
function renderInputPromptPreview(node){ return SmartCanvasComposer.renderInputPromptPreview(node); }
function renderInputThumbsRow(node){ return SmartCanvasComposer.renderInputThumbsRow(node); }
function bindInputThumbsDrag(node, items){ return window.SmartCanvasComposerInputThumbs?.bindInputThumbsDrag?.(node, items); }
function reorderInputThumb(currentNode, items, from, to){ return window.SmartCanvasComposerInputThumbs?.reorderInputThumb?.(currentNode, items, from, to); }
/* === D3 upload wrappers === */
function isSupportedUploadFile(...args){
    return window.SmartCanvasUpload?.isSupportedUploadFile?.(...args);
}
async function uploadFilesFromDataTransfer(...args){
    return window.SmartCanvasUpload?.uploadFilesFromDataTransfer?.(...args);
}
function uploadTitleForItems(...args){
    return window.SmartCanvasUpload?.uploadTitleForItems?.(...args);
}
async function smartResponseErrorMessage(...args){
    return window.SmartCanvasUpload?.smartResponseErrorMessage?.(...args);
}
function smartDropDataTypes(...args){
    return window.SmartCanvasUpload?.smartDropDataTypes?.(...args);
}
function readSmartDropData(...args){
    return window.SmartCanvasUpload?.readSmartDropData?.(...args);
}
function smartDropTextCandidates(...args){
    return window.SmartCanvasUpload?.smartDropTextCandidates?.(...args);
}
function smartImageDropPayload(...args){
    return window.SmartCanvasUpload?.smartImageDropPayload?.(...args);
}
async function resolveSmartImageDropPayload(...args){
    return window.SmartCanvasUpload?.resolveSmartImageDropPayload?.(...args);
}
function hasSmartImageDropData(...args){
    return window.SmartCanvasUpload?.hasSmartImageDropData?.(...args);
}
function hasSmartAssetDrag(...args){
    return window.SmartCanvasUpload?.hasSmartAssetDrag?.(...args);
}
function hasMediaDrawerDrag(...args){
    return window.SmartCanvasUpload?.hasMediaDrawerDrag?.(...args);
}
function hasSmartInputThumbDrag(...args){
    return window.SmartCanvasUpload?.hasSmartInputThumbDrag?.(...args);
}
function setSmartDropCopyEffect(...args){
    return window.SmartCanvasUpload?.setSmartDropCopyEffect?.(...args);
}
async function uploadFiles(...args){
    return window.SmartCanvasUpload?.uploadFiles?.(...args);
}
function appendImagesToSmartNode(...args){
    return window.SmartCanvasUpload?.appendImagesToSmartNode?.(...args);
}
async function handleFiles(...args){
    return window.SmartCanvasUpload?.handleFiles?.(...args);
}
async function importSmartLocalImages(...args){
    return window.SmartCanvasUpload?.importSmartLocalImages?.(...args);
}
async function handleSmartImageDropPayload(...args){
    return window.SmartCanvasUpload?.handleSmartImageDropPayload?.(...args);
}
function smartImageNameFromUrl(...args){
    return window.SmartCanvasUpload?.smartImageNameFromUrl?.(...args);
}
function dataTransferItemEntry(...args){
    return window.SmartCanvasUpload?.dataTransferItemEntry?.(...args);
}
async function filesFromEntry(...args){
    return window.SmartCanvasUpload?.filesFromEntry?.(...args);
}
function decodeSmartDropText(...args){
    return window.SmartCanvasUpload?.decodeSmartDropText?.(...args);
}
function smartDropTextFragments(...args){
    return window.SmartCanvasUpload?.smartDropTextFragments?.(...args);
}
function uniqueSmartDropValues(...args){
    return window.SmartCanvasUpload?.uniqueSmartDropValues?.(...args);
}
function isRemoteSmartImageDropValue(...args){
    return window.SmartCanvasUpload?.isRemoteSmartImageDropValue?.(...args);
}
function isLocalSmartImageDropValue(...args){
    return window.SmartCanvasUpload?.isLocalSmartImageDropValue?.(...args);
}
function smartLocalImagePathsFromDataTransfer(...args){
    return window.SmartCanvasUpload?.smartLocalImagePathsFromDataTransfer?.(...args);
}
function smartImageFilesFromDataTransfer(...args){
    return window.SmartCanvasUpload?.smartImageFilesFromDataTransfer?.(...args);
}
/* === end D3 upload wrappers === */

function sizeForRun(sourceSettings=settings, sourceImage=null){ return window.SmartCanvasComposerSettings?.sizeForRun?.(sourceSettings, sourceImage); }
function sizeForRunAsync(sourceSettings=settings, node=null, refs=null){ return window.SmartCanvasComposerSettings?.sizeForRunAsync?.(sourceSettings, node, refs); }
function expectedOutputSize(){ return window.SmartCanvasNodeOutputs?.expectedOutputSize?.(); }
function explicitRequestOutputSizeForPending(){ return window.SmartCanvasNodeOutputs?.explicitRequestOutputSizeForPending?.(); }
function pendingSizeFromImageRef(img){ return window.SmartCanvasNodeOutputs?.pendingSizeFromImageRef?.(img); }
function pendingSourceBoxSize(options={}){ return window.SmartCanvasNodeOutputs?.pendingSourceBoxSize?.(options); }
function displayBoxFromNaturalSize(size){ return window.SmartCanvasNodeOutputs?.displayBoxFromNaturalSize?.(size); }
function pendingBaseBoxSize(options={}){ return window.SmartCanvasNodeOutputs?.pendingBaseBoxSize?.(options); }
function pendingBoxSize(count, options={}){ return window.SmartCanvasNodeOutputs?.pendingBoxSize?.(count, options); }
function mentionTokenHtml(img){ return window.SmartCanvasMentionPicker?.mentionTokenHtml?.(img); }
function promptHtmlWithMentionTokens(text, refs=[]){ return window.SmartCanvasMentionPicker?.promptHtmlWithMentionTokens?.(text, refs); }
function snapshotRunMeta(prompt, sourceId, displayPrompt='', refs=[]){ return window.SmartCanvasNodeOutputs?.snapshotRunMeta?.(prompt, sourceId, displayPrompt, refs); }
function attachRunMeta(targetNode, meta){ return window.SmartCanvasNodeOutputs?.attachRunMeta?.(targetNode, meta); }
function stripRunInputMeta(meta){ return window.SmartCanvasNodeOutputs?.stripRunInputMeta?.(meta); }
function stripImageGenerationMeta(img){ return window.SmartCanvasNodeMeta?.stripImageGenerationMeta?.(img); }
function addConnection(fromId, toId, kind='flow'){ return window.SmartCanvasConnectionGraph?.addConnection?.(fromId, toId, kind); }
function connectInputNode(fromId, toId){ return window.SmartCanvasConnectionGraph?.connectInputNode?.(fromId, toId); }
function upstreamNodesForKinds(node, kinds=['input']){ return window.SmartCanvasConnectionGraph?.upstreamNodesForKinds?.(node, kinds); }
function inputNodesFor(node){ return window.SmartCanvasConnectionGraph?.inputNodesFor?.(node); }
function workflowInputNodesFor(node){ return window.SmartCanvasConnectionGraph?.workflowInputNodesFor?.(node); }
function imagesForNode(node){ return window.SmartCanvasMediaLayout?.imagesForNode?.(node); }
function nodeHasReferenceContent(node){ return window.SmartCanvasSmartLoop?.nodeHasReferenceContent?.(node); }
function isSelfReferenceForNode(node, img){ return window.SmartCanvasSmartLoop?.isSelfReferenceForNode?.(node, img); }
function candidateInputImagesFor(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.candidateInputImagesFor?.(node, consume, ctx); }
function defaultInputImagesFor(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.defaultInputImagesFor?.(node, consume, ctx); }
function splitSmartPromptItems(text){ return window.SmartCanvasSmartLoop?.splitSmartPromptItems?.(text); }
function smartLoopPromptFieldValues(node){ return window.SmartCanvasSmartLoop?.smartLoopPromptFieldValues?.(node); }
function smartLoopActivePromptFieldValues(node){ return window.SmartCanvasSmartLoop?.smartLoopActivePromptFieldValues?.(node); }
function setSmartLoopPromptFieldValues(node, values){ return window.SmartCanvasSmartLoop?.setSmartLoopPromptFieldValues?.(node, values); }
function smartLoopPromptFieldText(node, fieldIndex){ return window.SmartCanvasSmartLoop?.smartLoopPromptFieldText?.(node, fieldIndex); }
function smartLoopSelectedLocalPrompt(node, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.smartLoopSelectedLocalPrompt?.(node, ctx); }
function smartLoopUpstreamPromptPreviewHeight(node){ return window.SmartCanvasSmartLoop?.smartLoopUpstreamPromptPreviewHeight?.(node); }
function smartLoopInputPromptItems(node){ return window.SmartCanvasSmartLoop?.smartLoopInputPromptItems?.(node); }
function smartLoopSelectedInputPrompt(node, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.smartLoopSelectedInputPrompt?.(node, ctx); }
function smartLoopPrompt(node, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.smartLoopPrompt?.(node, ctx); }
function smartLoopInputImages(node, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.smartLoopInputImages?.(node, ctx); }
function smartLoopPreviewImages(node){ return window.SmartCanvasSmartLoop?.smartLoopPreviewImages?.(node); }
function outputImagesForNode(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.outputImagesForNode?.(node, consume, ctx); }
function selfReferenceImagesForNode(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.selfReferenceImagesForNode?.(node, consume, ctx); }
function textForNode(node, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.textForNode?.(node, ctx); }
function promptInputNodesFor(node){ return window.SmartCanvasPromptRequest?.promptInputNodesFor(node); }
function inputPromptTextFor(node, ctx=smartLoopContext){ return window.SmartCanvasPromptRequest?.inputPromptTextFor(node, ctx); }
function inputRefKey(img){ return window.SmartCanvasPromptRequest?.inputRefKey(img); }
function blockedInputRefKeys(node){ return window.SmartCanvasPromptRequest?.blockedInputRefKeys(node); }
function isInputRefBlocked(node, img){ return window.SmartCanvasPromptRequest?.isInputRefBlocked(node, img); }
function defaultReferenceImagesFor(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasPromptRequest?.defaultReferenceImagesFor(node, consume, ctx); }
function collectPromptParts(){ return window.SmartCanvasPromptRequest?.collectPromptParts(); }
function originalPromptTextFromParts(parts){ return window.SmartCanvasPromptRequest?.originalPromptTextFromParts(parts); }
function buildPromptRequest(node, overrideDefaultImages=null, consumeDefault=false, ctx=smartLoopContext){ return window.SmartCanvasPromptRequest?.buildPromptRequest(node, overrideDefaultImages, consumeDefault, ctx); }
function loadNodePromptDraftToInput(node){ return window.SmartCanvasPromptRequest?.loadNodePromptDraftToInput(node); }
function buildPromptRequestForNode(node, defaultImages, ctx=smartLoopContext){ return window.SmartCanvasPromptRequest?.buildPromptRequestForNode(node, defaultImages, ctx); }
function upstreamLoopPromptNodesFor(node){ return window.SmartCanvasConnectionGraph?.upstreamLoopPromptNodesFor?.(node); }
function inputImagesFor(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.inputImagesFor?.(node, consume, ctx); }
function workflowInputImagesFor(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.workflowInputImagesFor?.(node, consume, ctx); }
function activeInputImagesFor(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.activeInputImagesFor?.(node, consume, ctx); }
function toggleInputRefBlocked(node, img){ return window.SmartCanvasSmartLoop?.toggleInputRefBlocked?.(node, img); }
function upstreamLineReferenceImagesFor(node, consume=false, ctx=smartLoopContext){ return window.SmartCanvasConnectionGraph?.upstreamLineReferenceImagesFor?.(node, consume, ctx); }
function lineConnectionsFor(node){ return window.SmartCanvasConnectionGraph?.lineConnectionsFor?.(node); }
function connectedLineNodeIds(node){ return window.SmartCanvasConnectionGraph?.connectedLineNodeIds?.(node); }
function upstreamLineNodeIds(node){ return window.SmartCanvasConnectionGraph?.upstreamLineNodeIds?.(node); }
function lineImagesFor(node){ return window.SmartCanvasConnectionGraph?.lineImagesFor?.(node); }
function collectMentionedImagesFromPrompt(){ return window.SmartCanvasMentionPicker?.collectMentionedImagesFromPrompt?.(); }
function uniqueReferenceImages(images){ return window.SmartCanvasReferenceImages?.uniqueReferenceImages?.(images); }
function visibleReferenceImagesFor(node){ return window.SmartCanvasReferenceImages?.visibleReferenceImagesFor?.(node); }
function inputMentionCandidateImages(node){ return window.SmartCanvasMentionPicker?.inputMentionCandidateImages?.(node); }
function assetMentionCandidateImages(categoryId=''){ return window.SmartCanvasMentionPicker?.assetMentionCandidateImages?.(categoryId); }
function mentionCandidateImages(node, source=mentionSource){ return window.SmartCanvasMentionPicker?.mentionCandidateImages?.(node, source); }
function referenceImagesFor(node){ return window.SmartCanvasReferenceImages?.referenceImagesFor?.(node); }
function closeMentionPicker(){ return window.SmartCanvasMentionPicker?.closeMentionPicker?.(); }
function saveMentionRange(){ return window.SmartCanvasMentionPicker?.saveMentionRange?.(); }
function textBeforeCaret(){ return window.SmartCanvasMentionPicker?.textBeforeCaret?.(); }
function renderMentionPicker(source){ return window.SmartCanvasMentionPicker?.renderMentionPicker?.(source); }
function showMentionPicker(){ return window.SmartCanvasMentionPicker?.showMentionPicker?.(); }
function positionMentionPickerAtCaret(){ return window.SmartCanvasMentionPicker?.positionMentionPickerAtCaret?.(); }
function maybeOpenMentionPicker(){ return window.SmartCanvasMentionPicker?.maybeOpenMentionPicker?.(); }
function insertMentionToken(img){ return window.SmartCanvasMentionPicker?.insertMentionToken?.(img); }
function outgoingConnectionsFor(node, kinds=['input']){ return window.SmartCanvasConnectionGraph?.outgoingConnectionsFor?.(node, kinds); }
function outgoingInputConnectionsFor(node){ return window.SmartCanvasConnectionGraph?.outgoingInputConnectionsFor?.(node); }
function incomingLineConnectionsFor(node, kinds=['input','flow']){ return window.SmartCanvasConnectionGraph?.incomingLineConnectionsFor?.(node, kinds); }
function nodeHasIncomingSourceLine(node){ return window.SmartCanvasConnectionGraph?.nodeHasIncomingSourceLine?.(node); }
function nextOutputPositionForSource(sourceNode, pendingBox, options={}){ return window.SmartCanvasNodeOutputs?.nextOutputPositionForSource?.(sourceNode, pendingBox, options); }
function createPendingOutputFromSource(sourceNode, expectedCount, meta, options={}){ return window.SmartCanvasNodeOutputs?.createPendingOutputFromSource?.(sourceNode, expectedCount, meta, options); }
function createPendingOutputBatchFromSource(sourceNode, expectedCount, meta, options={}){ return window.SmartCanvasNodeOutputs?.createPendingOutputBatchFromSource?.(sourceNode, expectedCount, meta, options); }
function createParallelLoopOutputNode(templateNode, sourceNode, roundIndex, roundOffset=0){ return window.SmartCanvasNodeOutputs?.createParallelLoopOutputNode?.(templateNode, sourceNode, roundIndex, roundOffset); }
function loopOutputSlotsForRoot(rootNode){ return window.SmartCanvasCascade?.loopOutputSlotsForRoot?.(rootNode); }
function loopOutputSlotForRound(rootNode, loopNode, roundIndex, slotIndex){ return window.SmartCanvasCascade?.loopOutputSlotForRound?.(rootNode, loopNode, roundIndex, slotIndex); }
function tagLoopOutputSlot(output, rootNode, loopNode, roundIndex, slotIndex){ return window.SmartCanvasCascade?.tagLoopOutputSlot?.(output, rootNode, loopNode, roundIndex, slotIndex); }
function createLoopOutputSlot(rootNode, roundIndex, roundOffset=0, options={}){ return window.SmartCanvasCascade?.createLoopOutputSlot?.(rootNode, roundIndex, roundOffset, options); }
function extractCurrentImagesToSource(node, meta=null){ return window.SmartCanvasNodeOutputs?.extractCurrentImagesToSource?.(node, meta); }
function finalizePendingNode(pendingNode, urls, meta, kind='image'){ return window.SmartCanvasNodeOutputs?.finalizePendingNode?.(pendingNode, urls, meta, kind); }
function restoreFromExtraction(node, extracted){ return window.SmartCanvasNodeOutputs?.restoreFromExtraction?.(node, extracted); }
function finishLoopTargetPreviewState(node){ return window.SmartCanvasCascade?.finishLoopTargetPreviewState?.(node); }
function refsForDirectLoopRound(loopNode, loopIndex, total){ return window.SmartCanvasCascade?.refsForDirectLoopRound?.(loopNode, loopIndex, total); }
function showDirectLoopRoundPreview(loopNode, target, refs, loopIndex, total){ return window.SmartCanvasCascade?.showDirectLoopRoundPreview?.(loopNode, target, refs, loopIndex, total); }
function restoreSourceVisualState(node, state){ return window.SmartCanvasNodeOutputs?.restoreSourceVisualState?.(node, state); }
function directImageInputsFor(node){ return window.SmartCanvasConnectionGraph?.directImageInputsFor?.(node); }
function directImageInputsForKinds(node, kinds=['input']){ return window.SmartCanvasConnectionGraph?.directImageInputsForKinds?.(node, kinds); }
function primaryImageInputFor(node, options={}){ return window.SmartCanvasCascade?.primaryImageInputFor?.(node, options); }
function hasDownstreamImageNode(node){ return window.SmartCanvasCascade?.hasDownstreamImageNode?.(node); }
function isGeneratedOutputForNode(sourceNode, targetNode){ return window.SmartCanvasCascade?.isGeneratedOutputForNode?.(sourceNode, targetNode); }
function downstreamWorkflowImageTargetsFor(node){ return window.SmartCanvasCascade?.downstreamWorkflowImageTargetsFor?.(node); }
function hasDownstreamWorkflowImageNode(node){ return window.SmartCanvasCascade?.hasDownstreamWorkflowImageNode?.(node); }
function smartImageChainTo(nodeId, options={}){ return window.SmartCanvasCascade?.smartImageChainTo?.(nodeId, options); }
function upstreamNodesForId(nodeId, kinds=['input']){ return window.SmartCanvasCascade?.upstreamNodesForId?.(nodeId, kinds); }
function resolveSmartCascadeLoop(nodeId){ return window.SmartCanvasCascade?.resolveSmartCascadeLoop?.(nodeId); }
function relayLoopPromptNodesForEdge(sourceNode, targetNode){ return window.SmartCanvasCascade?.relayLoopPromptNodesForEdge?.(sourceNode, targetNode); }
function relayLoopPromptNodesForTarget(node){ return window.SmartCanvasCascade?.relayLoopPromptNodesForTarget?.(node); }
function downstreamNodesForId(nodeId){ return window.SmartCanvasCascade?.downstreamNodesForId?.(nodeId); }
function downstreamImageTargetsFor(node){ return window.SmartCanvasCascade?.downstreamImageTargetsFor?.(node); }
function downstreamCascadeTargetsFor(node){ return window.SmartCanvasCascade?.downstreamCascadeTargetsFor?.(node); }
function directLoopRunTargets(loop){ return window.SmartCanvasCascade?.directLoopRunTargets?.(loop); }
function smartCascadeGraphForTail(tail){ return window.SmartCanvasCascade?.smartCascadeGraphForTail?.(tail); }
function cascadeTailForLoop(loopId){ return window.SmartCanvasCascade?.cascadeTailForLoop?.(loopId); }
function canRunSmartCascade(node){ return window.SmartCanvasCascade?.canRunSmartCascade?.(node); }
function isDirectLoopTargetRun(loop, tail, graph){ return window.SmartCanvasCascade?.isDirectLoopTargetRun?.(loop, tail, graph); }
function cascadeConnectionKeys(){ return window.SmartCanvasCascade?.cascadeConnectionKeys?.(); }
function coolRunButton(ms=2000){ return window.SmartCanvasRunState?.coolRunButton?.(ms); }
function coolNodeRunningState(node, ms=2000){ return window.SmartCanvasRunState?.coolNodeRunningState?.(node, ms); }
function clearNodeRunningState(node){ return window.SmartCanvasRunState?.clearNodeRunningState?.(node); }
function pushRightSideNodes(sourceNode, delta){ return window.SmartCanvasNodeOutputs?.pushRightSideNodes?.(sourceNode, delta); }
function cascadeOutputTitle(kind='image', count=1){ return window.SmartCanvasNodeOutputs?.cascadeOutputTitle?.(kind, count); }
function cleanHistoryImages(images=[]){ return window.SmartCanvasNodeOutputs?.cleanHistoryImages?.(images); }
function hasHistoryConnection(nodeId, groupId){ return window.SmartCanvasNodeOutputs?.hasHistoryConnection?.(nodeId, groupId); }
function demoteHistoryGroupNode(group){ return window.SmartCanvasNodeOutputs?.demoteHistoryGroupNode?.(group); }
function historyGroupForNode(node){ return window.SmartCanvasNodeOutputs?.historyGroupForNode?.(node); }
function positionHistoryGroupForNode(node, group){ return window.SmartCanvasNodeOutputs?.positionHistoryGroupForNode?.(node, group); }
function ensureHistoryGroupForNode(node){ return window.SmartCanvasNodeOutputs?.ensureHistoryGroupForNode?.(node); }
function replaceOutputsToNodeWithHistory(node, additions, kind='image', meta=null, options={}){ return window.SmartCanvasNodeOutputs?.replaceOutputsToNodeWithHistory?.(node, additions, kind, meta, options); }
function replaceOutputsToNodeDirect(node, additions, kind='image', meta=null){ return window.SmartCanvasNodeOutputs?.replaceOutputsToNodeDirect?.(node, additions, kind, meta); }
function finalizeOverwritePendingNode(node, urls, meta, kind='image'){ return window.SmartCanvasNodeOutputs?.finalizeOverwritePendingNode?.(node, urls, meta, kind); }
function selectedImageForHd(node){ return window.SmartCanvasComposerSettings?.selectedImageForHd?.(node); }
function scaledImageSizeForSelectedNode(node, scale=1){ return window.SmartCanvasComposerSettings?.scaledImageSizeForSelectedNode?.(node, scale); }
function appendOutputsToNode(node, additions, kind='image', options={}){ return window.SmartCanvasNodeOutputs?.appendOutputsToNode?.(node, additions, kind, options); }
function syncCascadeRunButton(node=selectedNode()){ return window.SmartCanvasCascade?.syncCascadeRunButton?.(node); }
async function generateUrlsForCurrentSettings(node, prompt, refs, runSettings=settings){ return window.SmartCanvasCascade?.generateUrlsForCurrentSettings?.(node, prompt, refs, runSettings); }
async function generateComfyUrlsWithSettings(runSettings, prompt, refs){ return window.SmartCanvasCascade?.generateComfyUrlsWithSettings?.(runSettings, prompt, refs); }
async function runCascadeStepIntoNode(sourceNode, targetNode, inputRefs, ctx=smartLoopContext){ return window.SmartCanvasCascade?.runCascadeStepIntoNode?.(sourceNode, targetNode, inputRefs, ctx); }
async function runLoopRoundIntoSlot(loopNode, rootNode, outputSlot, loopIndex, ctx=smartLoopContext){ return window.SmartCanvasCascade?.runLoopRoundIntoSlot?.(loopNode, rootNode, outputSlot, loopIndex, ctx); }
function appendCascadeRefsToReceiver(node, refs, ctx=smartLoopContext){ return window.SmartCanvasCascade?.appendCascadeRefsToReceiver?.(node, refs, ctx); }
function cascadeRefsFromOutputs(outputs, targetNode){ return window.SmartCanvasCascade?.cascadeRefsFromOutputs?.(outputs, targetNode); }
function smartCascadeStopText(stopping=false){ return window.SmartCanvasCascade?.smartCascadeStopText?.(stopping); }
function smartCascadeAbortError(){ return window.SmartCanvasCascade?.smartCascadeAbortError?.(); }
function throwIfSmartCascadeStopRequested(runState=null){ return window.SmartCanvasCascade?.throwIfSmartCascadeStopRequested?.(runState); }
function requestSmartCascadeStop(loopId=''){ return window.SmartCanvasCascade?.requestSmartCascadeStop?.(loopId); }
function smartCascadeParallelLimit(chain=[]){ return window.SmartCanvasCascade?.smartCascadeParallelLimit?.(chain); }
async function runSmartCascadeRoundsWithLimit(roundIndexes, limit, runner, runState=null){ return window.SmartCanvasCascade?.runSmartCascadeRoundsWithLimit?.(roundIndexes, limit, runner, runState); }
async function runSmartCascade(targetNode=null){ return window.SmartCanvasCascade?.runSmartCascade?.(targetNode); }
function runSmartCascadeFromLoop(loopId){ return window.SmartCanvasCascade?.runSmartCascadeFromLoop?.(loopId); }
/* === generation module wrappers (D1c) === */
async function runGeneration(...args){
    return window.SmartCanvasGeneration?.runGeneration?.(...args);
}
async function runQuickHdGeneration(...args){
    return window.SmartCanvasGeneration?.runQuickHdGeneration?.(...args);
}
async function runApiGeneration(...args){
    return window.SmartCanvasGeneration?.runApiGeneration?.(...args);
}
async function runApiVideoGeneration(...args){
    return window.SmartCanvasGeneration?.runApiVideoGeneration?.(...args);
}
async function runComfyGeneration(...args){
    return window.SmartCanvasGeneration?.runComfyGeneration?.(...args);
}
async function runComfyText(...args){
    return window.SmartCanvasGeneration?.runComfyText?.(...args);
}
async function runComfyEnhance(...args){
    return window.SmartCanvasGeneration?.runComfyEnhance?.(...args);
}
async function runComfyEdit(...args){
    return window.SmartCanvasGeneration?.runComfyEdit?.(...args);
}
async function comfyNameForRef(...args){
    return window.SmartCanvasGeneration?.comfyNameForRef?.(...args);
}
function smartPendingTasks(...args){
    return window.SmartCanvasGeneration?.smartPendingTasks?.(...args);
}
async function cancelSmartNodeGeneration(...args){
    return window.SmartCanvasGeneration?.cancelSmartNodeGeneration?.(...args);
}
async function cancelSmartPendingTask(...args){
    return window.SmartCanvasGeneration?.cancelSmartPendingTask?.(...args);
}
async function cancelSmartPendingSlot(...args){
    return window.SmartCanvasGeneration?.cancelSmartPendingSlot?.(...args);
}
async function pollSmartCanvasTask(...args){
    return window.SmartCanvasGeneration?.pollSmartCanvasTask?.(...args);
}
function finalizeSmartPendingTask(...args){
    return window.SmartCanvasGeneration?.finalizeSmartPendingTask?.(...args);
}
async function resumeSmartPendingNode(...args){
    return window.SmartCanvasGeneration?.resumeSmartPendingNode?.(...args);
}
function resumeSmartPendingTasks(...args){
    return window.SmartCanvasGeneration?.resumeSmartPendingTasks?.(...args);
}
async function runModelscopeGeneration(...args){
    return window.SmartCanvasGeneration?.runModelscopeGeneration?.(...args);
}
async function runQueuedSmartComfyGenerate(...args){
    return window.SmartCanvasGeneration?.runQueuedSmartComfyGenerate?.(...args);
}
async function runRunningHubGeneration(...args){
    return window.SmartCanvasGeneration?.runRunningHubGeneration?.(...args);
}
function startJimengPoll(...args){
    return window.SmartCanvasGeneration?.startJimengPoll?.(...args);
}
function getActiveSmartTaskPolls(){
    return window.SmartCanvasGeneration?.getActiveSmartTaskPolls?.() || new Map();
}
/* === end generation wrappers === */

async function runPromptLLMNode(nodeId){ return window.SmartCanvasPromptLlm?.runPromptLLMNode?.(nodeId); }
async function runPromptLLMNodeBatch(nodeId, count){ return window.SmartCanvasPromptLlm?.runPromptLLMNodeBatch?.(nodeId, count); }
function comfyFieldKind(field){ return window.SmartCanvasComfyParams?.comfyFieldKind?.(field); }
function updateSelectionBox(event){ return window.SmartCanvasSelectionBox?.updateSelectionBox?.(event); }
function finishSelection(event){ return window.SmartCanvasSelectionBox?.finishSelection?.(event); }
function layoutNodesInGrid(nodeList, originX, originY, gap=24){ return window.SmartCanvasSelectionBox?.layoutNodesInGrid?.(nodeList, originX, originY, gap); }
function arrangeSelectedNodes(){ return window.SmartCanvasSelectionBox?.arrangeSelectedNodes?.(); }
function groupSelectedNodes(){ return window.SmartCanvasSmartGroup?.groupSelectedNodes?.(); }
function ungroupNode(groupId){ return window.SmartCanvasSmartGroup?.ungroupNode?.(groupId); }
function mergeImageNodesIntoGroup(sourceId, targetId){ return window.SmartCanvasSmartGroup?.mergeImageNodesIntoGroup?.(sourceId, targetId); }
function closeCreateMenu(){ return window.SmartCanvasCanvasNav?.closeCreateMenu?.(); }
function openCreateMenu(event, options = {}){
    window.SmartCanvasPortLinkMenu?.openBlankCreateMenu?.(event, options);
}
function createNodeFromMenu(type){ return window.SmartCanvasCanvasNav?.createNodeFromMenu?.(type); }
function syncApiKindToggleVisibility(){
    window.SmartCanvasComposerParams?.syncApiKindToggleVisibility?.();
}
function bindApiKindToggle(){
    window.SmartCanvasComposerParams?.bindApiKindToggle?.();
}
function syncComposerHdVisibility(){
    // 高清按钮已移至图片上方工具栏，此函数不再控制 composer 内的高清按钮
}
function closeComposerHdPopover(){ window.SmartCanvasImageEdit?.closeComposerHdPopover?.(); }
function setComposerHdScale(scale){ window.SmartCanvasImageEdit?.setComposerHdScale?.(scale); }
function showImageHdPopover(){ window.SmartCanvasImageEdit?.showImageHdPopover?.(); }
function positionImageHdPopover(){ window.SmartCanvasImageEdit?.positionImageHdPopover?.(); }
function hasCanvasImageDrag(event){ return window.SmartCanvasAssetLibrary?.hasCanvasImageDrag?.(event); }
function setAssetDragOver(active){ return window.SmartCanvasAssetLibrary?.setAssetDragOver?.(active); }
function handleAssetPanelDragOver(e){ return window.SmartCanvasAssetLibrary?.handleAssetPanelDragOver?.(e); }
async function handleAssetPanelDrop(e){ return window.SmartCanvasAssetLibrary?.handleAssetPanelDrop?.(e); }
function canvasAgentObservation(){ return window.SmartCanvasAgentActions?.canvasAgentObservation?.(); }
async function executeCanvasAgentActions(actions=[]){ return window.SmartCanvasAgentActions?.executeCanvasAgentActions?.(actions); }
function syncExternalImageTask(payload={}){ return window.SmartCanvasAgentActions?.syncExternalImageTask?.(payload); }
window.addEventListener('message', event => {
    const data = event.data || {};
    const fromShell = event.source === window.parent;
    const sameOrigin = !event.origin || event.origin === location.origin;
    if(!sameOrigin && !fromShell) return;
    if(data?.type === 'studio-theme') applyTheme(data.theme || 'light');
    if(event.data?.type === 'providers-changed' || event.data?.type === 'workflows-changed' || event.data?.type === 'comfy-instances-changed' || event.data?.type === 'runninghub-settings-changed') refreshSmartConfigFromSettings();
    if(event.data?.type === 'asset_library_updated') handleAssetLibraryUpdatedMessage(event.data);
    if(event.data?.type === 'shell-request-canvas-project-state') SmartCanvasHistory?.notifyShellCanvasProject?.();
    if(event.data?.type === 'canvas-clear-selection') clearSelection();
    if(event.data?.type === 'shell-canvas-clipboard'){
        const action = String(event.data.action || '').toLowerCase();
        focusCanvasForShortcuts();
        if(action === 'copy') copySelectedNodes();
        else if(action === 'paste') pasteNodes();
    }
    if(event.data?.type === 'shell-apply-prompt'){
        const text = String(event.data.text || '');
        if(text){
            setPromptText(text);
            try { document.getElementById('composer')?.classList.add('open'); } catch(_e) {}
            toast('已引用提示词到输入栏');
        }
    }
    if(event.data?.type === 'canvas-agent-actions') {
        executeCanvasAgentActions(event.data.actions || [])
            .then(results => window.parent.postMessage({type:'canvas-agent-results', request_id:event.data.request_id || '', results, observation:canvasAgentObservation()}, location.origin))
            .catch(error => window.parent.postMessage({type:'canvas-agent-results', request_id:event.data.request_id || '', results:[{ok:false,error:error?.message || 'Agent 画布操作失败'}], observation:canvasAgentObservation()}, location.origin));
    }
    if(event.data?.type === 'canvas-agent-observe') {
        window.parent.postMessage({type:'canvas-agent-observation', request_id:event.data.request_id || '', observation:canvasAgentObservation()}, location.origin);
    }
    if(event.data?.type === 'canvas-external-image-task') {
        syncExternalImageTask(event.data);
    }
    if(event.data?.type === 'studio-lang' && window.StudioI18n) {
        window.StudioI18n.set(event.data.lang || 'zh');
    }
});
window.addEventListener('studio-lang-change', () => {
    renderDynamicParams();
    renderInputThumbsRow(selectedNode());
    renderAssetLibrary();
    if(document.getElementById('imageEditModal')?.classList.contains('open')){
        setImageEditMode(imageEditMode);
    }
    if(promptTemplatePanel?.classList?.contains('open')) renderPromptTemplatePanel();
    render();
});
function registerSmartCanvasModuleDeps(){
    if(!window.SmartCanvasCore) return;
    SmartCanvasCore.registerDeps({
        get canvasId(){ return canvasId; },
        set canvasId(v){ canvasId = v; },
        get canvas(){ return canvas; },
        set canvas(v){ canvas = v; },
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get viewport(){ return viewport; },
        set viewport(v){ viewport = v; },
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        get canvasHydrated(){ return canvasHydrated; },
        get canvasSyncInFlight(){ return canvasSyncInFlight; }, set canvasSyncInFlight(v){ canvasSyncInFlight = v; },
        smartClientId,
        get dragState(){ return dragState; },
        get selectionState(){ return selectionState; },
        set canvasHydrated(v){ canvasHydrated = v; },
        get saveTimer(){ return saveTimer; },
        set saveTimer(v){ saveTimer = v; },
        get canvasDefaultSmartSettings(){ return canvasDefaultSmartSettings; },
        set canvasDefaultSmartSettings(v){ canvasDefaultSmartSettings = v; },
        initialSmartSettings,
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get smartGroupCapsuleOnly(){ return smartGroupCapsuleOnly; },
        get dragPending(){ return dragPending; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get uploadTargetId(){ return uploadTargetId; },
        set uploadTargetId(v){ uploadTargetId = v; },
        get pendingGroupUploadPoint(){ return pendingGroupUploadPoint; },
        set pendingGroupUploadPoint(v){ pendingGroupUploadPoint = v; },
        get assetLibraryOpen(){ return assetLibraryOpen; },
        get assetTab(){ return assetTab; },
        set assetTab(v){ assetTab = v; },
        get smartCascadeSilentSelection(){ return smartCascadeSilentSelection; },
        get activeComposerSubject(){ return activeComposerSubject; },
        set activeComposerSubject(v){ activeComposerSubject = v; },
        get lastComposerNodeId(){ return lastComposerNodeId; },
        set lastComposerNodeId(v){ lastComposerNodeId = v; },
        shell, world, composer, composerHeadParams, dynamicParams, cascadeRunBtn, promptInput, inputThumbsRow, inputPromptPreview, fileInput,
        canvasEmptyHint, updateCanvasEmptyHint,
        get apiProviders(){ return apiProviders; },
        setApiProviders(v){ apiProviders = Array.isArray(v) ? v : []; },
        imageProviders, videoApiProviders, providerImageModels, providerVideoModels,
        normalizeVideoProviderDefaults, ownerImageProviderForModel,
        bindApiKindToggle, bindDynamicParams, syncApiKindToggleVisibility,
        applySourceRatioToSettings, activeComposerNode,
        syncVideoCountFromSettings, volcengineProvider, volcengineVideoModels,
        bindSmartControlPills, updatePromptPlaceholder, persistActiveSmartSettings,
        apiKindToggle, applyRecentSmartSettingsForCurrentMode, updateComposer,
        setDynamicSetting, closeAllSmartPopovers, markControlInteracting,
        isGptImageAutoSizeModel, normalizeSmartVideoModeSettings,
        videoModelCapabilities, videoModelOptions, currentVideoReferenceMode, videoModeUsesSize,
        ownerImageProviderForModel, ownerVideoProviderForModel, ensureComfyWorkflow,
        uploadCurrentSmartVideosToCloud, setCurrentSmartManualVideoUrl,
        currentComfyFields, toggleSmartComfyRandom, toggleSmartRhRandom,
        rhActiveFields, rhParamKey, rhParamValue, activeSettingsSubject,
        rememberRecentSmartSettings, scheduleSave, toast,
        canvasMainBtn,
        get comfyWorkflowCache(){ return comfyWorkflowCache; },
        get runningHubWorkflowCache(){ return runningHubWorkflowCache; },
        get smartRhRandomValues(){ return smartRhRandomValues; },
        selectedRunningHubRef, smartComfyRandomValue, imageRefsOnly, videoRefsOnly, audioRefsOnly,
        tr, toast, escapeHtml, refreshIcons, render, applyViewport, safeScale,
        smartVideoGenerationCount,
        defaultSmartApiResolution, isGptImageAutoSizeModel, apiImageSize,
        ratioLabel, sourceImageRatioLabel, apiProviderById,
        MS_GEN_MODELS, modelscopeImageModels, videoProviderById,
        runningHubEntries, runningHubEntryKey, runningHubEntryId, runningHubEntryLabel, selectedRunningHubRef,
        get comfyWorkflows(){ return comfyWorkflows; },
        comfyParamValue, comfyRandomEnabledField, smartComfyRandomActive,
        rhParamKey, rhFieldRole, rhParamValue, rhExtractFieldOptions, rhRandomEnabled, smartRhRandomActive,
        rhActiveFields, comfyWorkflowCache, ensureComfyWorkflow, comfyFieldKind, renderDynamicParams,
        normalizeLegacySmartNode, smartPendingTasks, updateProviderModels, resumeSmartPendingTasks,
        loadRecentSmartSettings, cloneSmartSettings, savePromptDraftForCurrent, mediaItemForStorage,
        stripImageGenerationMeta, settingsForStorage, mergeSmartNodeLists, mergeSmartConnections,
        clearCompletedNodeBusyStates, recoverStuckLoopOutputsFromLogs: (...a) => window.SmartCanvasNodeMerge?.recoverStuckLoopOutputsFromLogs?.(...a), scheduleConnectionLayerRefresh,
        resumeJimengPendingNodes, selectedNode, isSmartImageNode, setPromptText, setPromptInputLocked,
        syncCascadeRunButton, smartSettingsForNode, loadPromptDraft, visibleReferenceImagesFor,
        isVideoMediaItem, isSelfReferenceForNode, smartImageMode, inputPromptTextFor, nodeRect,
        bindInputThumbsDrag, toggleAssetLibrary, createNewSmartCanvas,
        get smartLoopContext(){ return smartLoopContext; },
        buildPromptRequest, runApiGeneration, runApiVideoGeneration, pollSmartCanvasTask, resumeSmartPendingNode, pushUndo, scheduleSave, saveCanvas,
        rememberRecentSmartSettings, isApiLikeEngine, coolNodeRunningState, coolRunButton, syncRunButtonState, runPromptLLMNode, runPromptLLMNodeBatch,
        snapshotRunMeta, attachRunMeta, smartRunSnapshot, addSmartGenerationLog,
        mediaNodeDefaultScale, imageForDisplay, thumbMediaHtml, imageResolutionBadgeHtml, mediaKindForItem,
        nowMs, scheduleComposerReposition, escapeAttr, runGeneration, runBtn, resolveChatProviderId, resolveChatModel, chatProviderOptions, chatModelOptions,
        pendingBoxSize, createPendingOutputBatchFromSource, createPendingOutputFromSource, finalizePendingNode, animateViewportTo, positionComposerForNode, positionImageQuickToolbar,
        fitViewportToImageWithComposer, fitViewportToPromptNode, selectedImageElement,
        screenToWorld, createImageNodeAt, connectInputNode, commitPendingUndo, discardPendingUndo,
        handleFiles, deleteImage, pickMediaForSmartNode, promptPlainText, setPromptText, setPromptInputLocked, clearPromptInput, promptNodeInputMediaForLLM, inputImagesFor, outputImagesForNode, capturePendingUndo,
        hideImageQuickToolbar,
        createPromptNode, updateComposer, nodeRect, selectedNodeIds, groupSelectedNodes, ungroupNode, arrangeSelectedNodes,
        deleteNode, pushUndo, addUrlToAssetLibrary, zipDownloadImageItems, imageForDisplay,
        get undoSuppressed(){ return undoSuppressed; },
        set undoSuppressed(v){ undoSuppressed = v; },
        get activeAssetCategoryId(){ return activeAssetCategoryId; },
        set activeAssetCategoryId(v){ activeAssetCategoryId = v; },
        assetCategories, renderAssetLibrary, hideSelectionGroupBox, positionSelectionGroupBox,
        showSmartGroupCapsule, engageSmartGroup, smartGroupAtWorldPoint, smartGroupMembers, smartGroupImageRefs, queueSmartNodeDrag
    });
    window.SmartCanvasIsolatedFeatures?.install?.({
        getNodes: () => nodes,
        stripImageGenerationMeta,
        copyMediaSizeFields,
        replaceOutputsToNodeWithHistory: (...a) => window.SmartCanvasNodeOutputs?.replaceOutputsToNodeWithHistory?.(...a),
        get MEDIA_NODE_DEFAULT_SCALE(){ return MEDIA_NODE_DEFAULT_SCALE; },
        get MEDIA_GROUP_DEFAULT_SCALE(){ return MEDIA_GROUP_DEFAULT_SCALE; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        setNodes: v => { nodes = v; },
        getCanvas: () => canvas,
        setCanvas: v => { canvas = v; },
        getSelectedIds: () => selectedIds,
        setSelectedIds: v => { selectedIds = v; },
        getSelectedId: () => selectedId,
        setSelectedId: v => { selectedId = v; },
        getSelectedImage: () => selectedImage,
        setSelectedImage: v => { selectedImage = v; },
        getUndoSuppressed: () => undoSuppressed,
        setUndoSuppressed: v => { undoSuppressed = v; },
        getActiveAssetCategoryId: () => activeAssetCategoryId,
        setActiveAssetCategoryId: v => { activeAssetCategoryId = v; },
        selectedNodeIds,
        groupSelectedNodes,
        arrangeSelectedNodes,
        ungroupNode,
        deleteNode,
        disconnectConnections,
        refreshConnectionLayer,
        pushUndo,
        addUrlToAssetLibrary,
        zipDownloadImageItems,

        smartGroupBodyHtml,
        thumbMediaHtml,
        imageResolutionBadgeHtml,
        singleMediaHtml,
        resolveChatProviderId,
        resolveChatModel,
        smartNodeInputThumbsHtml,
        promptNodeInputImages,
        activePromptTemplateNodeId,
        promptNodeTextHeight,
        promptLlmInstructionHeight,
        chatProviderOptions,
        chatModelOptions,
        trf,
        smartLoopCount,
        smartLoopInputImages,
        smartLoopPreviewImages,
        smartLoopInputPromptItems,
        smartLoopPromptFieldValues,
        smartLoopSelectedInputPrompt,
        smartCascadeRunForLoop,
        smartCascadeStopText,
        imageForDisplay,
        isSmartGroupNode,
        smartGroupMembers,
        smartGroupImageRefs,
        toggleAssetLibrary,
        loadAssetLibrary,
        renderAssetLibrary,
        assetCategories,
        hideSelectionGroupBox,
        positionSelectionGroupBox,
        render,
        scheduleSave,
        tr,
        toast,
        escapeHtml,
        refreshIcons,
        isHistoryGroupNode,
        engageSmartGroup,
        queueSmartNodeDrag,
        capturePendingUndo,
        screenToWorld,
        selectCanvasImage,
        syncSelectionUi,
        updateComposer,
        focusCanvasForShortcuts,
        scheduleComposerReposition: (...args) => SmartCanvasComposer?.scheduleComposerReposition?.(...args),
        setSelectionMarqueeActive: v => { selectionMarqueeActive = v; },
        setSmartCascadeSilentSelection: v => { smartCascadeSilentSelection = v; },
        smartCascadeAnyRunning,
        smartGroupContainingNode,
        smartGroupHitBounds,
        nodeRect,
        addDraggedNodesToSmartGroup,
        pruneSmartGroupMembershipsForNode,
        cleanupEmptySmartGroups,
        arrangeSmartGroupMembers,
        createImageNodeAt,
        stripImageGenerationMeta,
        inheritNodeMetaFromImage,
        clearDetachedRunInputRefs,
        connectInputNode,
        canAutoConnectDraggedNode,
        dragConnectTargetFor,
        restoreDraggedNodePosition,
        rectOverlapNode
    });
    const assetLib = window.SmartCanvasAssetLibrary;
    assetLib?.registerDeps?.({
        tr,
        toast,
        escapeHtml,
        escapeAttr,
        refreshIcons,
        render,
        renderMentionPicker,
        getCanvasId: () => canvasId,
        LOCAL_ASSET_LIBRARY_ID,
        ASSET_SMART_CATEGORY_PREFIX,
        getCanvas: () => canvas,
        ASSET_GRID_SIZE_KEY,
        assetPanel,
        assetGrid,
        assetCategorySelect,
        assetLibrarySelect,
        assetImageControls,
        assetPromptLibrary,
        assetDropZone,
        assetBreadcrumb,
        assetToggle,
        assetDialogBackdrop,
        assetDialogInput,
        assetDialogOk,
        assetDialogCancel,
        assetDialogTitle,
        assetHoverPreview,
        mentionPicker,
        get assetLibrary(){ return assetLibrary; },
        set assetLibrary(v){ assetLibrary = v; },
        get activeAssetLibraryId(){ return activeAssetLibraryId; },
        set activeAssetLibraryId(v){ activeAssetLibraryId = v; },
        get activeAssetCategoryId(){ return activeAssetCategoryId; },
        set activeAssetCategoryId(v){ activeAssetCategoryId = v; },
        get assetLibraryOpen(){ return assetLibraryOpen; },
        set assetLibraryOpen(v){ assetLibraryOpen = v; },
        get assetGridSize(){ return assetGridSize; },
        set assetGridSize(v){ assetGridSize = v; },
        get assetLibraryUpdatedAt(){ return assetLibraryUpdatedAt; },
        set assetLibraryUpdatedAt(v){ assetLibraryUpdatedAt = v; },
        get assetLibraryRefreshTimer(){ return assetLibraryRefreshTimer; },
        set assetLibraryRefreshTimer(v){ assetLibraryRefreshTimer = v; },
        get mentionAssetCategoryId(){ return mentionAssetCategoryId; },
        set mentionAssetCategoryId(v){ mentionAssetCategoryId = v; },
        get mentionSource(){ return mentionSource; },
        set mentionSource(v){ mentionSource = v; },
        get assetTab(){ return assetTab; },
        set assetTab(v){ assetTab = v; },
        get localAssetLibrary(){ return localAssetLibrary; },
        set localAssetLibrary(v){ localAssetLibrary = v; },
        activeAssetCategory,
        setLocalAssetLibraryFromResponse,
        renderAssetLibrary,
        isSupportedUploadFile: (...a) => window.SmartCanvasUpload?.isSupportedUploadFile?.(...a),
        importSmartLocalImages: (...a) => window.SmartCanvasUpload?.importSmartLocalImages?.(...a),
        smartImageNameFromUrl: (...a) => window.SmartCanvasUpload?.smartImageNameFromUrl?.(...a),
        get lastMouseWorld(){ return lastMouseWorld; },
        set lastMouseWorld(v){ lastMouseWorld = v; },
        get lastNodePasteAt(){ return lastNodePasteAt; },
        set lastNodePasteAt(v){ lastNodePasteAt = v; },
        viewportCenter: (...a) => window.SmartCanvasViewport?.viewportCenter?.(...a),
        createImageNodeAt: (...a) => window.SmartCanvasNodeFactory?.createImageNodeAt?.(...a),
        pushUndo: (...a) => window.SmartCanvasUndo?.pushUndo?.(...a),
        scheduleSave,
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        copyMediaSizeFields,
        smartOriginalMediaUrl: (...a) => window.SmartCanvasMediaLayout?.smartOriginalMediaUrl?.(...a),
        displayMediaUrl: (...a) => window.SmartCanvasMediaLayout?.displayMediaUrl?.(...a),
        activeWorkflowAssetCategory,
        activeComposerNode,
        selectedNode,
        addManualReferenceToSelectedNode,
    });
    window.SmartCanvasAssetLibraryUi?.registerDeps?.({
        tr,
        toast,
        escapeHtml,
        refreshIcons,
        openAssetNameDialog: (...args) => assetLib?.openAssetNameDialog?.(...args),
        renderAssetLibrary: (...args) => assetLib?.renderAssetLibrary?.(...args),
        ensureCanvasAssetLibrary: (...args) => assetLib?.ensureCanvasAssetLibrary?.(...args),
        syncActiveCanvasAssetLibrary: (...args) => assetLib?.syncActiveCanvasAssetLibrary?.(...args),
        canvasAssetLibraryForCurrentCanvas: (...args) => assetLib?.canvasAssetLibraryForCurrentCanvas?.(...args),
        assetLibraries: (...args) => assetLib?.assetLibraries?.(...args),
        assetCategories: (...args) => assetLib?.assetCategories?.(...args),
        assetChildCategories: (...args) => assetLib?.assetChildCategories?.(...args),
        assetCategoryById: (...args) => assetLib?.assetCategoryById?.(...args),
        activeAssetCategory: (...args) => assetLib?.activeAssetCategory?.(...args),
        createAssetFolderAt: (...args) => assetLib?.createAssetFolderAt?.(...args),
        renameAssetCategory: (...args) => assetLib?.renameAssetCategory?.(...args),
        deleteAssetCategory: (...args) => assetLib?.deleteAssetCategory?.(...args),
        renderAssetGalleryGrid: (...args) => assetLib?.renderAssetGalleryGrid?.(...args),
        getCanvasId: () => canvasId,
        getActiveAssetLibraryId: () => activeAssetLibraryId,
        setActiveAssetLibraryId: v => { activeAssetLibraryId = v; },
        getActiveAssetCategoryId: () => activeAssetCategoryId,
        setActiveAssetCategoryId: v => { activeAssetCategoryId = v; }
    });
    const promptTemplates = window.SmartCanvasPromptTemplates;
    promptTemplates?.registerDeps?.({
        uid,
        tr,
        toast,
        escapeHtml,
        escapeAttr,
        refreshIcons,
        render,
        syncSelectionUi,
        scheduleSave,
        promptPlainText,
        setPromptText,
        savePromptDraftForCurrent,
        renderInputThumbsRow,
        selectedNode,
        getNodes: () => nodes,
        PROMPT_PRESETS_KEY,
        PROMPT_TEMPLATE_GROUPS_KEY,
        PROMPT_TEMPLATE_OVERRIDES_KEY,
        promptPresetPanel,
        promptPresetStatus,
        promptPresetSelect,
        promptPresetName,
        promptPresetText,
        promptPresetApply,
        promptPresetDelete,
        promptPresetNew,
        promptPresetSave,
        promptTemplatePanel,
        promptTemplateSearch,
        promptTemplateLibrarySelect,
        promptTemplateCats,
        promptTemplateBody,
        composerTemplateBtn,
        shell,
        world,
        promptInput,
        get promptPresets(){ return promptPresets; },
        set promptPresets(v){ promptPresets = v; },
        get builtinPromptTemplates(){ return builtinPromptTemplates; },
        set builtinPromptTemplates(v){ builtinPromptTemplates = v; },
        get promptLibraries(){ return promptLibraries; },
        set promptLibraries(v){ promptLibraries = v; },
        get activePromptLibraryId(){ return activePromptLibraryId; },
        set activePromptLibraryId(v){ activePromptLibraryId = v; },
        get promptTemplateGroups(){ return promptTemplateGroups; },
        set promptTemplateGroups(v){ promptTemplateGroups = v; },
        get promptTemplateOverrides(){ return promptTemplateOverrides; },
        set promptTemplateOverrides(v){ promptTemplateOverrides = v; },
        get promptTemplateCategory(){ return promptTemplateCategory; },
        set promptTemplateCategory(v){ promptTemplateCategory = v; },
        get promptTemplateSelectedId(){ return promptTemplateSelectedId; },
        set promptTemplateSelectedId(v){ promptTemplateSelectedId = v; },
        get promptTemplateEditing(){ return promptTemplateEditing; },
        set promptTemplateEditing(v){ promptTemplateEditing = v; },
        get promptTemplateGroupEditMode(){ return promptTemplateGroupEditMode; },
        set promptTemplateGroupEditMode(v){ promptTemplateGroupEditMode = v; },
        get promptPresetDeleteArmed(){ return promptPresetDeleteArmed; },
        set promptPresetDeleteArmed(v){ promptPresetDeleteArmed = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
    });
    window.SmartCanvasAssetPromptUi?.registerDeps?.({
        tr,
        toast,
        escapeHtml,
        refreshIcons,
        openAssetNameDialog,
        renderPromptLibrarySelect: () => promptTemplates?.renderPromptLibrarySelect?.(),
        smartResponseErrorMessage,
        defaultPromptPresetName: (...args) => promptTemplates?.defaultPromptPresetName?.(...args),
        promptPlainText,
        setPromptText,
        savePromptDraftForCurrent,
        renderInputThumbsRow,
        selectedNode,
        scheduleSave,
        getPromptLibraries: () => promptLibraries,
        setPromptLibraries: v => { promptLibraries = v; },
        getActivePromptLibraryId: () => activePromptLibraryId,
        setActivePromptLibraryId: v => { activePromptLibraryId = v; },
        getAssetTab: () => assetTab
    });
    window.SmartCanvasImagePreview?.registerDeps?.({
        imageEditModal,
        getNodes: () => nodes,
        currentEditImage: (...a) => window.SmartCanvasImageEdit?.currentEditImage?.(...a),
        mediaKindForItem,
        displayMediaUrl,
        proxiedMediaUrl,
        downloadNameForMediaItem,
        inputImagesFor,
        escapeHtml,
        tr,
        toast,
        scheduleSave,
        uploadFiles,
        fileNameFromUrl,
        safeExportFileName,
        nodeRect,
        viewportCenter,
        pushUndo,
        createImageNodeAt,
        render,
        updateZoomLabel: () => window.SmartCanvasImageEdit?.updateZoomLabel?.(),
        getPanoramaRatioPresets: () => PANORAMA_RATIO_PRESETS,
        get panoramaState(){ return panoramaState; },
        get previewZoom(){ return previewZoom; },
        set previewZoom(v){ previewZoom = v; },
        get previewPan(){ return previewPan; },
        set previewPan(v){ previewPan = v; },
        get previewComparePos(){ return previewComparePos; },
        set previewComparePos(v){ previewComparePos = v; },
        get previewCompareOn(){ return previewCompareOn; },
        set previewCompareOn(v){ previewCompareOn = v; },
        get previewCompareIndex(){ return previewCompareIndex; },
        set previewCompareIndex(v){ previewCompareIndex = v; },
        get previewMetaExtraText(){ return previewMetaExtraText; },
        set previewMetaExtraText(v){ previewMetaExtraText = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
    });
    const imageDraw = window.SmartCanvasImageDraw;
    imageDraw?.registerDeps?.({
        uid,
        syncGridCustomUndoBtn,
        get EDIT_DRAW_HISTORY_MAX(){ return EDIT_DRAW_HISTORY_MAX; },
        get editDrawState(){ return editDrawState; },
        set editDrawState(v){ editDrawState = v; },
        get editTextItems(){ return editTextItems; },
        set editTextItems(v){ editTextItems = v; },
        get editTextSelectedId(){ return editTextSelectedId; },
        set editTextSelectedId(v){ editTextSelectedId = v; },
        get editTextDrag(){ return editTextDrag; },
        set editTextDrag(v){ editTextDrag = v; },
        get editTextDirty(){ return editTextDirty; },
        set editTextDirty(v){ editTextDirty = v; },
        get editTextInlineEditor(){ return editTextInlineEditor; },
        set editTextInlineEditor(v){ editTextInlineEditor = v; },
        get editDrawUndoStack(){ return editDrawUndoStack; },
        set editDrawUndoStack(v){ editDrawUndoStack = v; },
        get editDrawRedoStack(){ return editDrawRedoStack; },
        set editDrawRedoStack(v){ editDrawRedoStack = v; },
        get brushTool(){ return brushTool; },
        set brushTool(v){ brushTool = v; },
        get brushLabelCounter(){ return brushLabelCounter; },
        set brushLabelCounter(v){ brushLabelCounter = v; },
        get imageEditMode(){ return imageEditMode; },
        get gridCustomMode(){ return gridCustomMode; },
        get gridCustomLines(){ return gridCustomLines; },
        set gridCustomLines(v){ gridCustomLines = v; },
        get gridCustomOrientation(){ return gridCustomOrientation; },
        set gridCustomOrientation(v){ gridCustomOrientation = v; },
        get gridCustomHistory(){ return gridCustomHistory; },
        set gridCustomHistory(v){ gridCustomHistory = v; },
        get gridCustomDrag(){ return gridCustomDrag; },
        set gridCustomDrag(v){ gridCustomDrag = v; },
    });
    window.SmartCanvasImageEdit?.registerDeps?.({
        isSmartGroupNode: (...a) => window.SmartCanvasSmartGroup?.isSmartGroupNode?.(...a),
        smartGroupImageRefs: (...a) => window.SmartCanvasSmartGroup?.smartGroupImageRefs?.(...a),
        smartGroupContainingNode: (...a) => window.SmartCanvasSmartGroup?.smartGroupContainingNode?.(...a),
        shell,
        imageEditModal,
        imageQuickToolbar,
        imageHdPopover,
        selectedImageElement,
        get composerHdScale(){ return composerHdScale; },
        set composerHdScale(v){ composerHdScale = v; },
        syncSelectionUi,
        getNodes: () => nodes,
        imageForDisplay,
        displayMediaUrl,
        proxiedMediaUrl,
        scheduleSave,
        syncGridCustomControls,
        syncGridCustomUndoBtn,
        downloadNodeImage,
        toast,
        resetEditDrawingHistory: (...args) => imageDraw?.resetEditDrawingHistory?.(...args),
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get previewNavState(){ return previewNavState; },
        set previewNavState(v){ previewNavState = v; },
        get previewCompareOn(){ return previewCompareOn; },
        set previewCompareOn(v){ previewCompareOn = v; },
        get previewCompareIndex(){ return previewCompareIndex; },
        set previewCompareIndex(v){ previewCompareIndex = v; },
        get previewPanDrag(){ return previewPanDrag; },
        set previewPanDrag(v){ previewPanDrag = v; },
        get previewCompareDrag(){ return previewCompareDrag; },
        set previewCompareDrag(v){ previewCompareDrag = v; },
        get imageEditPanDrag(){ return imageEditPanDrag; },
        set imageEditPanDrag(v){ imageEditPanDrag = v; },
        get cropDrag(){ return cropDrag; },
        set cropDrag(v){ cropDrag = v; },
        get editDrawState(){ return editDrawState; },
        set editDrawState(v){ editDrawState = v; },
        get editTextItems(){ return editTextItems; },
        set editTextItems(v){ editTextItems = v; },
        get editTextSelectedId(){ return editTextSelectedId; },
        set editTextSelectedId(v){ editTextSelectedId = v; },
        get editTextDrag(){ return editTextDrag; },
        set editTextDrag(v){ editTextDrag = v; },
        get editTextDirty(){ return editTextDirty; },
        set editTextDirty(v){ editTextDirty = v; },
        get gridCustomHistory(){ return gridCustomHistory; },
        set gridCustomHistory(v){ gridCustomHistory = v; },
        get gridCustomDrag(){ return gridCustomDrag; },
        set gridCustomDrag(v){ gridCustomDrag = v; },
        get cutoutSelectionMask(){ return cutoutSelectionMask; },
        set cutoutSelectionMask(v){ cutoutSelectionMask = v; },
        get cutoutSourceImageData(){ return cutoutSourceImageData; },
        set cutoutSourceImageData(v){ cutoutSourceImageData = v; },
        get cutoutLastSeed(){ return cutoutLastSeed; },
        set cutoutLastSeed(v){ cutoutLastSeed = v; },
        get cutoutHistory(){ return cutoutHistory; },
        set cutoutHistory(v){ cutoutHistory = v; },
        get cutoutLastAction(){ return cutoutLastAction; },
        set cutoutLastAction(v){ cutoutLastAction = v; },
        get imageEditBaseW(){ return imageEditBaseW; },
        set imageEditBaseW(v){ imageEditBaseW = v; },
        get imageEditBaseH(){ return imageEditBaseH; },
        set imageEditBaseH(v){ imageEditBaseH = v; },
        get imageEditZoom(){ return imageEditZoom; },
        set imageEditZoom(v){ imageEditZoom = v; },
        get imageEditMode(){ return imageEditMode; },
        set imageEditMode(v){ imageEditMode = v; },
        get imageEditModeTouched(){ return imageEditModeTouched; },
        set imageEditModeTouched(v){ imageEditModeTouched = v; },
        get gridCustomMode(){ return gridCustomMode; },
        set gridCustomMode(v){ gridCustomMode = v; },
        get gridCustomLines(){ return gridCustomLines; },
        set gridCustomLines(v){ gridCustomLines = v; },
        get gridCustomOrientation(){ return gridCustomOrientation; },
        set gridCustomOrientation(v){ gridCustomOrientation = v; },
        get previewZoom(){ return previewZoom; },
        get panoramaState(){ return panoramaState; },
        getCropState: () => cropState,
        setCropState: v => { cropState = v; },
        currentEditImage,
        mediaKindForItem,
        removeEditTextInlineEditor: (...args) => imageDraw?.removeEditTextInlineEditor?.(...args),
        previewDownloadGroupItems,
        tr,
        syncGridGapValue,
        clearEditDrawing: (...args) => imageDraw?.clearEditDrawing?.(...args),
        syncEditDrawingHistoryButtons: (...args) => imageDraw?.syncEditDrawingHistoryButtons?.(...args),
        syncBrushToolButtons: (...args) => imageDraw?.syncBrushToolButtons?.(...args),
        syncTextToolState: (...args) => imageDraw?.syncTextToolState?.(...args),
        refreshIcons,
        editDrawCanvas: (...args) => imageDraw?.editDrawCanvas?.(...args),
        editTextCanvas: (...args) => imageDraw?.editTextCanvas?.(...args),
        cropBounds,
        exceedsFourKStandard,
        gridSplitSettings: (...a) => window.SmartCanvasImageEdit?.gridSplitSettings?.(...a),
        resizeEditDrawCanvas: (...args) => imageDraw?.resizeEditDrawCanvas?.(...args),
        render,
        scheduleSave,
        setPromptDraftForNode,
        promptInput,
        editCanvasHasPixels: (...args) => imageDraw?.editCanvasHasPixels?.(...args),
        gridSplitRects: (...a) => window.SmartCanvasImageEdit?.gridSplitRects?.(...a),
        gridLayoutFromRects: (...a) => window.SmartCanvasImageEdit?.gridLayoutFromRects?.(...a),
        createNode,
        imageLayout,
        nodeScale,
        safeExportFileName,
        downloadNameForMediaItem,
        applyOutpaintSizeToSmartParams,
    });
    window.SmartCanvasNodesRender?.registerDeps?.({
        get world(){ return world; },
        get composer(){ return composer; },
        get canvas(){ return canvas; },
        get nodes(){ return nodes; },
        get dragState(){ return dragState; },
        get loopInsertPreview(){ return loopInsertPreview; },
        get selectionMarqueeActive(){ return selectionMarqueeActive; },
        get imageQuickToolbar(){ return imageQuickToolbar; },
        get selectedImage(){ return selectedImage; },
        nodeRect,
        cascadeConnectionKeys,
        smartCascadeEdgeState,
        selectedNode,
        positionComposerForNode,
        positionSelectionGroupBox,
        positionImageQuickToolbar,
        imageLayout,
        nodeScale,
        promptNodeTextHeight,
        promptLlmInstructionHeight,
        promptNodeContentHeight,
        renderMinimap,
        scheduleInteractionLayerRefresh,
        isVideoMediaItem,
        isAudioMediaItem,
        isSmartGroupNode,
        isSmartGroupCompactMember,
        smartGroupContainingNode,
        isSmartImageNode,
        isHistoryGroupNode,
        isNodeSelected,
        escapeHtml,
        escapeAttr,
        tr,
        trf,
        smartGroupBodyHtml,
        thumbMediaHtml,
        imageResolutionBadgeHtml,
        singleMediaHtml,
        resolveChatProviderId,
        resolveChatModel,
        smartNodeInputThumbsHtml,
        promptNodeInputImages,
        activePromptTemplateNodeId,
        chatProviderOptions,
        chatModelOptions,
        smartLoopCount,
        smartLoopInputImages,
        smartLoopPreviewImages,
        smartLoopInputPromptItems,
        smartLoopPromptFieldValues,
        smartLoopSelectedInputPrompt,
        smartCascadeRunForLoop,
        smartCascadeStopText,
        smartGroupToolbarHtml,
        bindNodeEvents,
        updateComposer,
        updateCanvasEmptyHint,
        bindImageProxyFallback,
        applyThumbDisplaySizeToElement,
        singleImageLayout,
        mediaNodeDefaultScale,
        scheduleSave,
        cleanupDetachedRunInputRefs: (...a) => window.SmartCanvasConnectionGraph?.cleanupDetachedRunInputRefs?.(...a),
        clearDetachedRunInputRefs: (...a) => window.SmartCanvasConnectionGraph?.clearDetachedRunInputRefs?.(...a),
        disconnectConnection,
        nowMs,
        imageForDisplay,
        mediaKindForItem,
        typedPlaceholderKind,
        ensureTypedPlaceholder,
    });



    const nodeMetaMod = window.SmartCanvasNodeMeta;
    nodeMetaMod?.registerDeps?.({});
    const overlayChromeMod = window.SmartCanvasOverlayChrome;
    overlayChromeMod?.registerDeps?.({
        get assetLibraryOpen(){ return assetLibraryOpen; },
        set assetLibraryOpen(v){ assetLibraryOpen = v; },
        assetPanel, toggleAssetLibrary,
        closePromptPresetPanel, closePromptTemplatePanel, canvasMainBtn, shell,
    });
    const nodeClipboardMod = window.SmartCanvasNodeClipboard;
    nodeClipboardMod?.registerDeps?.({
        get canvas(){ return canvas; },
        set canvas(v){ canvas = v; },
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get nodeClipboard(){ return nodeClipboard; },
        set nodeClipboard(v){ nodeClipboard = v; },
        get lastNodePasteAt(){ return lastNodePasteAt; },
        set lastNodePasteAt(v){ lastNodePasteAt = v; },
        get lastMouseWorld(){ return lastMouseWorld; },
        set lastMouseWorld(v){ lastMouseWorld = v; },
        isEditableTarget, selectedNodeIds, toast, pushUndo, viewportCenter,
        cloneSmartNode, serializableSmartNode, render, scheduleSave, isNodeSelected,
        tr, trf,
    });
    const nodeFactoryMod = window.SmartCanvasNodeFactory;
    nodeFactoryMod?.registerDeps?.({
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        pushUndo, uid, tr, render, scheduleSave, toast,
        mediaNodeDefaultScale, inheritNodeMetaFromImage,
        resolveChatProviderId, resolveChatModel, imageLayout,
        nodeRect, imageForDisplay,
        ensureTypedPlaceholder,
        get MEDIA_GROUP_DEFAULT_SCALE(){ return MEDIA_GROUP_DEFAULT_SCALE; },
        get PROMPT_NODE_DEFAULT_WIDTH(){ return PROMPT_NODE_DEFAULT_WIDTH; },
        get PROMPT_NODE_DEFAULT_HEIGHT(){ return PROMPT_NODE_DEFAULT_HEIGHT; },
    });
    window.SmartCanvasNodeEvents?.registerDeps?.({
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get dragState(){ return dragState; },
        set dragState(v){ dragState = v; },
        get dragPending(){ return dragPending; },
        set dragPending(v){ dragPending = v; },
        get portDragState(){ return portDragState; },
        set portDragState(v){ portDragState = v; },
        get world(){ return world; },
        get selectionMarqueeActive(){ return selectionMarqueeActive; },
        set selectionMarqueeActive(v){ selectionMarqueeActive = v; },
        get smartCascadeSilentSelection(){ return smartCascadeSilentSelection; },
        set smartCascadeSilentSelection(v){ smartCascadeSilentSelection = v; },
        get suppressNodeClickUntil(){ return suppressNodeClickUntil; },
        set suppressNodeClickUntil(v){ suppressNodeClickUntil = v; },
        get suppressImageClickUntil(){ return suppressImageClickUntil; },
        set suppressImageClickUntil(v){ suppressImageClickUntil = v; },
        get uploadTargetId(){ return uploadTargetId; },
        set uploadTargetId(v){ uploadTargetId = v; },
        get pendingGroupUploadPoint(){ return pendingGroupUploadPoint; },
        set pendingGroupUploadPoint(v){ pendingGroupUploadPoint = v; },
        get thumbDragState(){ return thumbDragState; },
        set thumbDragState(v){ thumbDragState = v; },
        get resizeState(){ return resizeState; },
        set resizeState(v){ resizeState = v; },
        get textSelectionGuard(){ return textSelectionGuard; },
        set textSelectionGuard(v){ textSelectionGuard = v; },
        get lastMouseWorld(){ return lastMouseWorld; },
        set lastMouseWorld(v){ lastMouseWorld = v; },
        get undoSuppressed(){ return undoSuppressed; },
        set undoSuppressed(v){ undoSuppressed = v; },
        get undoStack(){ return undoStack; },
        get nodeClipboard(){ return nodeClipboard; },
        set nodeClipboard(v){ nodeClipboard = v; },
        get canvas(){ return canvas; },
        set canvas(v){ canvas = v; },
        get saveTimer(){ return saveTimer; },
        set saveTimer(v){ saveTimer = v; },
        tr, trf, toast, render, scheduleSave, pushUndo, capturePendingUndo, commitPendingUndo,
        discardPendingUndo, nodeRect, screenToWorld, connectInputNode, addConnection,
        duplicateForAltDrag, focusCanvasForShortcuts, syncSelectionUi, updateComposer,
        hideSelectionGroupBox, positionSelectionGroupBox, openCreateMenu, selectCanvasImage,
        noteImageClickForDouble, activateImageDoubleClick, activatePromptNodeDoubleClick,
        clearImageClickTimer, showSmartGroupCapsule, runSmartGroupToolbarAction,
        editPromptPresetForNode, runPromptLLMNode, resolveChatProviderId, resolveChatModel,
        promptNodeTextHeight, promptLlmInstructionHeight, promptNodeContentHeight,
        syncPromptNodeElementHeights, fitSmartLoopNode, smartLoopCount,
        smartLoopActivePromptFieldValues, setSmartLoopPromptFieldValues, smartLoopEditorText,
        insertSmartLoopToken, smartCascadeIsLoopRunning, requestSmartCascadeStop,
        runSmartCascadeFromLoop, smartCascadeAnyRunning, cancelSmartNodeGeneration, cancelSmartPendingTask, cancelSmartPendingSlot,
        hideRunTimerForNode, deleteNodeFromButton, deleteImage, handleFiles,
        resolveSmartImageDropPayload, handleSmartImageDropPayload, setSmartDropCopyEffect,
        isSmartImageNode, isSmartGroupNode, isHistoryGroupNode, smartGroupContainingNode,
        isNodeSelected, selectedNode, uid, escapeHtml, refreshIcons,
        mediaKindForItem, smartActivateVideoPreview, copySelectedNodes, pasteNodes,
        createNewSmartCanvas, arrangeSelectedNodes, performUndo, toggleAssetLibrary,
        downloadNodeImage, zipDownloadImageItems, saveNodeImageAs, zipSaveImageItemsAs,
    });

    window.SmartCanvasUpload?.registerDeps?.({
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get undoSuppressed(){ return undoSuppressed; },
        set undoSuppressed(v){ undoSuppressed = v; },
        tr,
        toast,
        pushUndo,
        render,
        scheduleSave,
        selectedNode,
        isSmartImageNode,
        viewportCenter,
        createImageNodeAt,
        mediaKindForFile,
        mediaKindForItem,
        get MEDIA_NODE_DEFAULT_SCALE(){ return MEDIA_NODE_DEFAULT_SCALE; },
        get MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE(){ return MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE; },
        get MEDIA_GROUP_DEFAULT_SCALE(){ return MEDIA_GROUP_DEFAULT_SCALE; },
    });

    const providerSelectionMod = window.SmartCanvasProviderSelection;
    providerSelectionMod?.registerDeps?.({
        getApiProviders: () => apiProviders,
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        escapeHtml,
        isApiLikeEngine,
        get DEFAULT_VIDEO_MODELS(){ return DEFAULT_VIDEO_MODELS; },
        jimengImageEditMode: (...a) => window.SmartCanvasGeneration?.jimengImageEditMode?.(...a),
        jimengVideoCommand: (...a) => window.SmartCanvasGeneration?.jimengVideoCommand?.(...a),
    });
    const smartMediaRefsMod = window.SmartCanvasSmartMediaRefs;
    smartMediaRefsMod?.registerDeps?.({
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        get transientSmartCloudLinks(){ return transientSmartCloudLinks; },
        set transientSmartCloudLinks(v){ transientSmartCloudLinks = v; },
        localDisplayUrlForMediaItem: (...a) => window.SmartCanvasMediaLayout?.localDisplayUrlForMediaItem?.(...a),
        smartOriginalMediaUrl,
        mediaKindForItem,
        buildPromptRequest: (...a) => window.SmartCanvasPromptRequest?.buildPromptRequest?.(...a),
        get smartLoopContext(){ return smartLoopContext; },
        inputThumbsRow,
        tr,
        activeSettingsSubject: () => window.SmartCanvasComposerSettings?.activeSettingsSubject?.(),
        savePromptDraftForCurrent,
        openAssetNameDialog,
        persistActiveSmartSettings: (...a) => window.SmartCanvasComposerSettings?.persistActiveSmartSettings?.(...a),
        scheduleSave, render, toast,
        dynamicParams,
        smartResponseErrorMessage,
    });
    const configLoaderMod = window.SmartCanvasConfigLoader;
    configLoaderMod?.registerDeps?.({
        get apiProviders(){ return apiProviders; },
        set apiProviders(v){ apiProviders = v; },
        get comfyWorkflows(){ return comfyWorkflows; },
        set comfyWorkflows(v){ comfyWorkflows = v; },
        get comfyInstanceCount(){ return comfyInstanceCount; },
        set comfyInstanceCount(v){ comfyInstanceCount = v; },
        get lastConfigRefreshAt(){ return lastConfigRefreshAt; },
        set lastConfigRefreshAt(v){ lastConfigRefreshAt = v; },
        syncApiProvidersFromModule,
        sanitizeSmartApiSelection,
        updateProviderModels,
        selectedNode,
        composer,
        renderComposerHeadParams,
        get settings(){ return settings; },
        toast, tr,
        render,
        renderDynamicParams: () => window.SmartCanvasComposerParams?.renderDynamicParams?.(),
    });
    const promptLlmMod = window.SmartCanvasPromptLlm;
    promptLlmMod?.registerDeps?.({
        getNodes: () => nodes,
        toast, tr,
        resolveChatProviderId: (...a) => window.SmartCanvasProviderSelection?.resolveChatProviderId?.(...a),
        resolveChatModel: (...a) => window.SmartCanvasProviderSelection?.resolveChatModel?.(...a),
        promptNodeInputMediaForLLM: (...a) => window.SmartCanvasPromptLayout?.promptNodeInputMediaForLLM?.(...a), outputImagesForNode: (...a) => window.SmartCanvasSmartLoop?.outputImagesForNode?.(...a),
        imageRefsOnly, videoRefsOnly,
        render, scheduleSave,
    });
    const runStateMod = window.SmartCanvasRunState;
    runStateMod?.registerDeps?.({
        runBtn,
        get runBtnCooldownToken(){ return runBtnCooldownToken; },
        set runBtnCooldownToken(v){ runBtnCooldownToken = v; },
        get smartRunStateToken(){ return smartRunStateToken; },
        set smartRunStateToken(v){ smartRunStateToken = v; },
        get smartNodeRunTokens(){ return smartNodeRunTokens; },
        smartCascadeAnyRunning: () => window.SmartCanvasCascade?.smartCascadeAnyRunning?.(),
        getNodes: () => nodes,
        render,
        smartPendingTasks: (...a) => window.SmartCanvasGeneration?.smartPendingTasks?.(...a),
        escapeHtml,
    });
    const comfyParamsMod = window.SmartCanvasComfyParams;
    comfyParamsMod?.registerDeps?.({
        getComfyWorkflowCache: () => comfyWorkflowCache,
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        persistActiveSmartSettings: (...a) => window.SmartCanvasComposerSettings?.persistActiveSmartSettings?.(...a),
        renderDynamicParams: () => window.SmartCanvasComposerParams?.renderDynamicParams?.(),
        scheduleSave,
    });
    const composerSettingsMod = window.SmartCanvasComposerSettings;
    composerSettingsMod?.registerDeps?.({
        get SIZE_MAP(){ return SIZE_MAP; },
        get RES_LONG_SIDE(){ return RES_LONG_SIDE; },
        get RES_PIXEL_LIMIT(){ return RES_PIXEL_LIMIT; },
        parseSizePair: (...a) => window.SmartCanvasNodeModel?.parseSizePair?.(...a),
        validOutpaintSize: (...a) => window.SmartCanvasNodeModel?.validOutpaintSize?.(...a),
        isApiLikeEngine, cloneSmartSettings,
        recentSmartSettingsForMode: (...a) => window.SmartCanvasSettingsRecent?.recentSmartSettingsForMode?.(...a),
        get canvasDefaultSmartSettings(){ return canvasDefaultSmartSettings; },
        get initialSmartSettings(){ return initialSmartSettings; },
        syncVideoCountFromSettings,
        get activeComposerSubject(){ return activeComposerSubject; },
        get lastComposerNodeId(){ return lastComposerNodeId; },
        selectedNode, isSmartImageNode, composer,
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        settingsForStorage,
        rememberRecentSmartSettings: (...a) => window.SmartCanvasSettingsRecent?.rememberRecentSmartSettings?.(...a),
        getNodes: () => nodes,
        sourceImageRatioLabel: (...a) => window.SmartCanvasComposerSettings?.sourceImageRatioLabel?.(...a),
        world, displayMediaUrl, tr,
        isAudioMediaItem,
        get selectedImage(){ return selectedImage; },
        imagesForNode: (...a) => window.SmartCanvasMediaLayout?.imagesForNode?.(...a),
        defaultReferenceImagesFor: (...a) => window.SmartCanvasPromptRequest?.defaultReferenceImagesFor?.(...a),
        imagesForNode: (...a) => window.SmartCanvasMediaLayout?.imagesForNode?.(...a),
        mediaKindForItem: (...a) => window.SmartCanvasNodeModel?.mediaKindForItem?.(...a),
        imageSizeForRatio: (...a) => window.SmartCanvasComposerSettings?.imageSizeForRatio?.(...a),
        parseSizeValue: (...a) => window.SmartCanvasComposerSettings?.parseSizeValue?.(...a),
        sizeForRun: (...a) => window.SmartCanvasComposerSettings?.sizeForRun?.(...a),
        nodeRect: (...a) => window.SmartCanvasMediaLayout?.nodeRect?.(...a),
                upstreamLineReferenceImagesFor: (...a) => window.SmartCanvasConnectionGraph?.upstreamLineReferenceImagesFor?.(...a),
    });
    const nodeModelMod = window.SmartCanvasNodeModel;
    nodeModelMod?.registerDeps?.({
        isSmartImageNode, stripImageGenerationMeta, mediaKindForItem, tr,
        get smartLoopContext(){ return smartLoopContext; },
    });
    const canvasHintMod = window.SmartCanvasCanvasHint;
    canvasHintMod?.registerDeps?.({
        getNodes: () => nodes,
        canvasEmptyHint,
        shell,
    });
    const settingsStorageMod = window.SmartCanvasSettingsStorage;
    settingsStorageMod?.registerDeps?.({
        get settings(){ return settings; },
        set settings(v){ settings = v; },
    });
    const settingsRecentMod = window.SmartCanvasSettingsRecent;
    settingsRecentMod?.registerDeps?.({
        get RECENT_SMART_SETTINGS_KEY(){ return RECENT_SMART_SETTINGS_KEY; },
        get recentSmartSettingsByMode(){ return recentSmartSettingsByMode; },
        set recentSmartSettingsByMode(v){ recentSmartSettingsByMode = v; },
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        cloneSmartSettings,
        stripOutpaintDisplaySettings: (...a) => window.SmartCanvasComposerSettings?.stripOutpaintDisplaySettings?.(...a),
        settingsForStorage,
        sanitizeSmartApiSelection, smartSettingsModeKey, isApiLikeEngine,
    });
    const nodeSelectionMod = window.SmartCanvasNodeSelection;
    nodeSelectionMod?.registerDeps?.({
        getNodes: () => nodes, world, shell,
        get composer(){ return composer; },
        get selectedId(){ return selectedId; }, set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; }, set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; }, set selectedImage(v){ selectedImage = v; },
        get smartGroupCapsuleOnly(){ return smartGroupCapsuleOnly; }, set smartGroupCapsuleOnly(v){ smartGroupCapsuleOnly = v; },
        get selectionMarqueeActive(){ return selectionMarqueeActive; }, set selectionMarqueeActive(v){ selectionMarqueeActive = v; },
        get imageClickTimer(){ return imageClickTimer; }, set imageClickTimer(v){ imageClickTimer = v; },
        get imageDblClickState(){ return imageDblClickState; }, set imageDblClickState(v){ imageDblClickState = v; },
        get IMAGE_DBLCLICK_MS(){ return IMAGE_DBLCLICK_MS; },
        get smartCascadeSilentSelection(){ return smartCascadeSilentSelection; }, set smartCascadeSilentSelection(v){ smartCascadeSilentSelection = v; },
        savePromptDraftForCurrent, hideImageQuickToolbar,
        hideSelectionGroupBox: (...a) => window.SmartCanvasSelectionBox?.hideSelectionGroupBox?.(...a),
        isSmartGroupNode, smartGroupContainingNode,
        smartCascadeAnyRunning: (...a) => window.SmartCanvasCascade?.smartCascadeAnyRunning?.(...a),
        updateComposer, positionComposerForNode, positionImageQuickToolbar,
        positionSelectionGroupBox: (...a) => window.SmartCanvasSelectionBox?.positionSelectionGroupBox?.(...a),
        hideRunTimerForNode: (...a) => window.SmartCanvasNodesRender?.hideRunTimerForNode?.(...a),
        queueSmartNodeDrag: (...a) => window.SmartCanvasNodeEvents?.queueSmartNodeDrag?.(...a),
        selectedNode,
    });
    const undoMod = window.SmartCanvasUndo;
    undoMod?.registerDeps?.({
        get UNDO_LIMIT(){ return UNDO_LIMIT; },
        get undoStack(){ return undoStack; },
        get undoSuppressed(){ return undoSuppressed; },
        set undoSuppressed(v){ undoSuppressed = v; },
        get pendingUndoSnapshot(){ return pendingUndoSnapshot; },
        set pendingUndoSnapshot(v){ pendingUndoSnapshot = v; },
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get canvas(){ return canvas; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get activeComposerSubject(){ return activeComposerSubject; },
        set activeComposerSubject(v){ activeComposerSubject = v; },
        get lastComposerNodeId(){ return lastComposerNodeId; },
        set lastComposerNodeId(v){ lastComposerNodeId = v; },
        tr, toast, render, scheduleSave,
    });
    const selectionBoxMod = window.SmartCanvasSelectionBox;
    selectionBoxMod?.registerDeps?.({
        getNodes: () => nodes,
        get viewport(){ return viewport; },
        selectionBox, selectionBoxCapsule,
        selectedNodeIds,
        nodeRect: (...args) => window.SmartCanvasMediaLayout?.nodeRect?.(...args),
        isSmartGroupNode, smartGroupMembers, smartGroupContainingNode,
        getCanvas: () => canvas,
        get selectionMarqueeActive(){ return selectionMarqueeActive; },
        set selectionMarqueeActive(v){ selectionMarqueeActive = v; },
        get smartGroupCapsuleOnly(){ return smartGroupCapsuleOnly; },
        set smartGroupCapsuleOnly(v){ smartGroupCapsuleOnly = v; },
        worldToScreen: (...args) => window.SmartCanvasViewport?.worldToScreen?.(...args),
        screenToWorld: (...args) => window.SmartCanvasViewport?.screenToWorld?.(...args),
        get selectionState(){ return selectionState; },
        set selectionState(v){ selectionState = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get selectionJustFinished(){ return selectionJustFinished; },
        set selectionJustFinished(v){ selectionJustFinished = v; },
        focusCanvasForShortcuts, syncSelectionUi, updateComposer, render, pushUndo, scheduleSave, toast,
    });
    const viewportMod = window.SmartCanvasViewport;
    viewportMod?.registerDeps?.({
        get viewport(){ return viewport; },
        getNodes: () => nodes,
        shell, world, minimap, minimapContent,
        get minimapViewport(){ return minimapViewport; },
        set minimapViewport(v){ minimapViewport = v; },
        get viewportAnimToken(){ return viewportAnimToken; },
        set viewportAnimToken(v){ viewportAnimToken = v; },
        get viewportAnimFrame(){ return viewportAnimFrame; },
        set viewportAnimFrame(v){ viewportAnimFrame = v; },
        get smartMinimapState(){ return smartMinimapState; },
        set smartMinimapState(v){ smartMinimapState = v; },
        get zoomPreviewState(){ return zoomPreviewState; },
        set zoomPreviewState(v){ zoomPreviewState = v; },
        nodeRect: (...args) => window.SmartCanvasMediaLayout?.nodeRect?.(...args),
        scheduleSave, positionImageQuickToolbar,
        positionSelectionGroupBox: (...args) => window.SmartCanvasSelectionBox?.positionSelectionGroupBox?.(...args),
        get selectionMarqueeActive(){ return selectionMarqueeActive; },
        selectedNode, positionComposerForNode, isSmartImageNode,
        selectedImageElement,
        closeCreateMenu,
        safeScale: (...a) => window.SmartCanvasMediaLayout?.safeScale?.(...a),
        exitZoomPreview,
        get composer(){ return composer; },
    });
    const referenceImagesMod = window.SmartCanvasReferenceImages;
    referenceImagesMod?.registerDeps?.({
        defaultReferenceImagesFor: (...args) => window.SmartCanvasPromptRequest?.defaultReferenceImagesFor?.(...args),
        collectMentionedImagesFromPrompt: (...args) => window.SmartCanvasMentionPicker?.collectMentionedImagesFromPrompt?.(...args),
        mediaKindForItem: (...a) => window.SmartCanvasMediaLayout?.mediaKindForItem?.(...a),
        displayMediaUrl: (...a) => window.SmartCanvasMediaLayout?.displayMediaUrl?.(...a),
        smartOriginalMediaUrl: (...a) => window.SmartCanvasMediaLayout?.smartOriginalMediaUrl?.(...a),
    });
    const promptReq = window.SmartCanvasPromptRequest;
    promptReq?.registerDeps?.({
        tr,
        textForNode,
        inputNodesFor,
        uniqueReferenceImages: (...args) => window.SmartCanvasReferenceImages?.uniqueReferenceImages?.(...args),
        defaultInputImagesFor,
        smartImageUsesWorkflowInput,
        smartLoopPrompt: (...a) => window.SmartCanvasSmartLoop?.smartLoopPrompt?.(...a),
        smartGroupMembers: (...a) => window.SmartCanvasSmartGroup?.smartGroupMembers?.(...a),
        inputNodesFor: (...a) => window.SmartCanvasConnectionGraph?.inputNodesFor?.(...a),
        smartLoopContext,
        selfReferenceImagesForNode,
        promptHtmlWithMentionTokens,
        setPromptText,
        promptInput,
        get smartLoopContext(){ return smartLoopContext; },
        getNodes: () => nodes,
    });
    const smartLoopMod = window.SmartCanvasSmartLoop;
    smartLoopMod?.registerDeps?.({
        smartImageUsesWorkflowInput,
        inputNodesFor: (...args) => window.SmartCanvasConnectionGraph?.inputNodesFor?.(...args),
        upstreamNodesForKinds: (...args) => window.SmartCanvasConnectionGraph?.upstreamNodesForKinds?.(...args),
        workflowInputNodesFor: (...args) => window.SmartCanvasConnectionGraph?.workflowInputNodesFor?.(...args),
        imagesForNode: (...args) => window.SmartCanvasMediaLayout?.imagesForNode?.(...args),
        smartLoopCount,
        tr, trf,
        runningHubRunNeedsPrompt: (...a) => window.SmartCanvasRunningHub?.runningHubRunNeedsPrompt?.(...a),
        isApiLikeEngine: (...a) => window.SmartCanvasSettingsStorage?.isApiLikeEngine?.(...a),
        get settings(){ return settings; },
        get smartLoopContext(){ return smartLoopContext; },
        isInputRefBlocked: (...args) => window.SmartCanvasPromptRequest?.isInputRefBlocked?.(...args),
        inputRefKey: (...args) => window.SmartCanvasPromptRequest?.inputRefKey?.(...args),
        blockedInputRefKeys: (...args) => window.SmartCanvasPromptRequest?.blockedInputRefKeys?.(...args),
        pushUndo, renderInputThumbsRow, scheduleSave,
    });
    const connectionGraphMod = window.SmartCanvasConnectionGraph;
    connectionGraphMod?.registerDeps?.({
        getNodes: () => nodes,
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get canvas(){ return canvas; },
        get canvasUsesConnections(){ return canvasUsesConnections; },
        getCanvas: () => canvas,
        nodeRect: (...args) => window.SmartCanvasMediaLayout?.nodeRect?.(...args),
        isHistoryGroupNode, isSmartImageNode,
        fitSmartLoopNode: (...args) => window.SmartCanvasPromptLayout?.fitSmartLoopNode?.(...args),
        imagesForNode: (...args) => window.SmartCanvasMediaLayout?.imagesForNode?.(...args),
        outputImagesForNode: (...args) => window.SmartCanvasSmartLoop?.outputImagesForNode?.(...args),
        uniqueReferenceImages: (...args) => window.SmartCanvasReferenceImages?.uniqueReferenceImages?.(...args),
        promptInputNodesFor: (...args) => window.SmartCanvasPromptRequest?.promptInputNodesFor?.(...args),
        smartImageUsesWorkflowInput, refreshConnectionLayer,
        get smartLoopContext(){ return smartLoopContext; },
        get dragState(){ return dragState; },
        get loopInsertPreview(){ return loopInsertPreview; },
        set loopInsertPreview(v){ loopInsertPreview = v; },
        syncUpstreamTextIntoDraft: node => window.SmartCanvasPromptDraft?.syncUpstreamTextIntoDraft?.(node),
        pushUndo, render, scheduleSave, demoteHistoryGroupNode,
    });
    const cascade = window.SmartCanvasCascade;
    const nodeOutputs = window.SmartCanvasNodeOutputs;
    const promptLayoutMod = window.SmartCanvasPromptLayout;
    promptLayoutMod?.registerDeps?.({
        get PROMPT_NODE_TEXT_DEFAULT_H(){ return PROMPT_NODE_TEXT_DEFAULT_H; },
        get PROMPT_NODE_TEXT_MIN_H(){ return PROMPT_NODE_TEXT_MIN_H; },
        get PROMPT_NODE_TEXT_MAX_H(){ return PROMPT_NODE_TEXT_MAX_H; },
        get PROMPT_SPLIT_RESIZE_BAR_H(){ return PROMPT_SPLIT_RESIZE_BAR_H; },
        get PROMPT_LLM_INSTRUCTION_DEFAULT_H(){ return PROMPT_LLM_INSTRUCTION_DEFAULT_H; },
        get PROMPT_LLM_INSTRUCTION_MIN_H(){ return PROMPT_LLM_INSTRUCTION_MIN_H; },
        get PROMPT_LLM_INSTRUCTION_MAX_H(){ return PROMPT_LLM_INSTRUCTION_MAX_H; },
        get PROMPT_NODE_DEFAULT_WIDTH(){ return PROMPT_NODE_DEFAULT_WIDTH; },
        get PROMPT_NODE_DEFAULT_HEIGHT(){ return PROMPT_NODE_DEFAULT_HEIGHT; },
        get PROMPT_NODE_LEGACY_WIDTHS(){ return PROMPT_NODE_LEGACY_WIDTHS; },
        get PROMPT_NODE_LEGACY_HEIGHTS(){ return PROMPT_NODE_LEGACY_HEIGHTS; },
        smartImageUsesWorkflowInput,
        workflowInputImagesFor: (...args) => window.SmartCanvasSmartLoop?.workflowInputImagesFor?.(...args),
        inputImagesFor: (...args) => window.SmartCanvasSmartLoop?.inputImagesFor?.(...args),
        isAudioMediaItem, isVideoMediaItem,
        escapeHtml, world, refreshConnectionLayer,
        smartLoopWidth: (...args) => window.SmartCanvasMediaLayout?.smartLoopWidth?.(...args),
        smartLoopHeight: (...args) => window.SmartCanvasMediaLayout?.smartLoopHeight?.(...args),
        get promptSplitResizeState(){ return promptSplitResizeState; },
        updateNodeElementDuringResize,
    });
    const mediaLayoutMod = window.SmartCanvasMediaLayout;
    mediaLayoutMod?.registerDeps?.({
        getNodes: () => nodes,
        get MEDIA_NODE_DEFAULT_SCALE(){ return MEDIA_NODE_DEFAULT_SCALE; },
        get MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE(){ return MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE; },
        get MEDIA_GROUP_DEFAULT_SCALE(){ return MEDIA_GROUP_DEFAULT_SCALE; },
        get MEDIA_GROUP_THUMB_BASE(){ return MEDIA_GROUP_THUMB_BASE; },
        get EMPTY_UPLOAD_NODE_WIDTH(){ return EMPTY_UPLOAD_NODE_WIDTH; },
        get EMPTY_UPLOAD_NODE_HEIGHT(){ return EMPTY_UPLOAD_NODE_HEIGHT; },
        get PROMPT_NODE_DEFAULT_WIDTH(){ return PROMPT_NODE_DEFAULT_WIDTH; },
        get PROMPT_NODE_DEFAULT_HEIGHT(){ return PROMPT_NODE_DEFAULT_HEIGHT; },
        get PROMPT_NODE_LEGACY_WIDTHS(){ return PROMPT_NODE_LEGACY_WIDTHS; },
        get PROMPT_NODE_LEGACY_HEIGHTS(){ return PROMPT_NODE_LEGACY_HEIGHTS; },
        smartGroupThumbLayout, smartGroupLayoutSize,
        promptNodeLayoutSize: (...args) => window.SmartCanvasPromptLayout?.promptNodeLayoutSize?.(...args),
        smartLoopPromptFieldValues: (...args) => window.SmartCanvasSmartLoop?.smartLoopPromptFieldValues?.(...args),
        smartLoopUpstreamPromptPreviewHeight: (...args) => window.SmartCanvasSmartLoop?.smartLoopUpstreamPromptPreviewHeight?.(...args),
        smartLoopPreviewImages: (...args) => window.SmartCanvasSmartLoop?.smartLoopPreviewImages?.(...args),
        smartNodeInputThumbsHeight: (...args) => window.SmartCanvasPromptLayout?.smartNodeInputThumbsHeight?.(...args),
        escapeHtml, escapeAttr, tr,
        parseSizeValue: (...a) => window.SmartCanvasComposerSettings?.parseSizeValue?.(...a),
    });
    window.SmartCanvasMediaDownload?.registerDeps?.({
        get nodes(){ return nodes; },
        get previewNavState(){ return previewNavState; },
        toast,
        mediaKindForItem,
        fileNameFromUrl,
        downloadPreviewFile: (...a) => window.SmartCanvasImagePreview?.downloadPreviewFile?.(...a),
        isSmartGroupNode: (...a) => window.SmartCanvasSmartGroup?.isSmartGroupNode?.(...a),
        smartGroupImageRefs: (...a) => window.SmartCanvasSmartGroup?.smartGroupImageRefs?.(...a),
    });
    window.SmartCanvasNodeToolbar?.registerDeps?.({
        get nodes(){ return nodes; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        imageEditModal,
        toast, render, scheduleSave,
        isSmartGroupNode: (...a) => window.SmartCanvasSmartGroup?.isSmartGroupNode?.(...a),
        arrangeSmartGroupMembers: (...a) => window.SmartCanvasSmartGroup?.arrangeSmartGroupMembers?.(...a),
        ungroupNode,
        openImagePreview: (...a) => window.SmartCanvasImagePreview?.openImagePreview?.(...a),
        zipDownloadImageItems: (...a) => window.SmartCanvasMediaDownload?.zipDownloadImageItems?.(...a),
        imageForDisplay,
        openImageEditor: (...a) => window.SmartCanvasImageEdit?.openImageEditor?.(...a),
        setImageEditMode: (...a) => window.SmartCanvasImageEdit?.setImageEditMode?.(...a),
        setGridOperationMode,
        smartNodeToolbarImageIndex,
        mediaKindForItem,
        downloadPreviewFile: (...a) => window.SmartCanvasImagePreview?.downloadPreviewFile?.(...a),
        duplicateSmartNodeMediaToCanvas: (...a) => window.SmartCanvasNodeFactory?.duplicateSmartNodeMediaToCanvas?.(...a),
        smartPendingTasks: (...a) => window.SmartCanvasGeneration?.smartPendingTasks?.(...a),
        canGridJoinCurrentNode: (...a) => window.SmartCanvasImageGridJoin?.canGridJoinCurrentNode?.(...a),
        smartPendingTasks: (...a) => window.SmartCanvasGeneration?.smartPendingTasks?.(...a),
    });
    const composerInputThumbsMod = window.SmartCanvasComposerInputThumbs;
    composerInputThumbsMod?.registerDeps?.({
        inputThumbsRow,
        get nodes(){ return nodes; },
        pushUndo, render, scheduleSave,
    });
    const promptInputMod = window.SmartCanvasPromptInput;
    promptInputMod?.registerDeps?.({
        promptInput,
        closeMentionPicker,
        get activeComposerSubject(){ return activeComposerSubject; },
    });
    const canvasNavMod = window.SmartCanvasCanvasNav;
    canvasNavMod?.registerDeps?.({
        savePromptDraftForCurrent,
        createMenu, shell,
        updateCanvasEmptyHint: (...a) => window.SmartCanvasCanvasHint?.updateCanvasEmptyHint?.(...a),
        get createMenuPoint(){ return createMenuPoint; },
        viewportCenter: (...a) => window.SmartCanvasViewport?.viewportCenter?.(...a),
        createPromptNode, createLoopNode, createImageNodeAt,
    });
    const promptDraftMod = window.SmartCanvasPromptDraft;
    promptDraftMod?.registerDeps?.({
        promptInput,
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        activeComposerNode,
        promptPlainText,
        cloneSmartSettings,
        isSmartImageNode,
        activeSettingsSubject,
        escapeHtml,
        promptHtmlWithMentionTokens,
        setPromptText,
        selectedNode,
        inputPromptTextFor,
    });
    const mentionPickerMod = window.SmartCanvasMentionPicker;
    mentionPickerMod?.registerDeps?.({
        mentionPicker,
        promptInput,
        promptResize: typeof promptResize !== 'undefined' ? promptResize : document.getElementById('promptResize'),
        get mentionRange(){ return mentionRange; },
        set mentionRange(v){ mentionRange = v; },
        get mentionSource(){ return mentionSource; },
        set mentionSource(v){ mentionSource = v; },
        get mentionAssetCategoryId(){ return mentionAssetCategoryId; },
        set mentionAssetCategoryId(v){ mentionAssetCategoryId = v; },
        inputThumbsRow,
        tr, escapeHtml, refreshIcons, mediaKindForItem,
        lineImagesFor,
        collectPromptParts: (...args) => window.SmartCanvasPromptRequest?.collectPromptParts?.(...args),
        assetCategories: (...args) => window.SmartCanvasAssetLibrary?.assetCategories?.(...args),
        assetCategoryForMention: (...args) => window.SmartCanvasAssetLibrary?.assetCategoryForMention?.(...args),
        assetMediaKind: (...args) => window.SmartCanvasAssetLibrary?.assetMediaKind?.(...args),
        selectedNode,
        renderInputThumbsRow,
    });
    const smartGroup = window.SmartCanvasSmartGroup;
    smartGroup?.registerDeps?.({
        getNodes: () => nodes,
        setNodes: v => { nodes = v; },
        getCanvas: () => canvas,
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get selectionMarqueeActive(){ return selectionMarqueeActive; },
        get createMenuGroupId(){ return createMenuGroupId; },
        get dragState(){ return dragState; },
        get viewport(){ return viewport; },
        world,
        pushUndo, nodeRect, uid, tr, toast,
        isSmartImageNode, stripImageGenerationMeta, inheritNodeMetaFromImage, clearDetachedRunInputRefs,
        imageLayout, thumbDisplaySize, nodeScale, imageForDisplay,
        render, scheduleSave, showSmartGroupCapsule,
        positionSelectionGroupBox, hideSelectionGroupBox, selectedNodeIds,
        updateNodeElementDuringResize,
        get MEDIA_NODE_DEFAULT_SCALE(){ return MEDIA_NODE_DEFAULT_SCALE; },
        get MEDIA_GROUP_DEFAULT_SCALE(){ return MEDIA_GROUP_DEFAULT_SCALE; },
        get SMART_GROUP_DEFAULT_WIDTH(){ return SMART_GROUP_DEFAULT_WIDTH; },
        get SMART_GROUP_DEFAULT_HEIGHT(){ return SMART_GROUP_DEFAULT_HEIGHT; },
        get SMART_GROUP_CARD_PADDING(){ return SMART_GROUP_CARD_PADDING; },
        get SMART_GROUP_MIN_WIDTH(){ return SMART_GROUP_MIN_WIDTH; },
        get SMART_GROUP_MIN_HEIGHT(){ return SMART_GROUP_MIN_HEIGHT; },
        get SMART_GROUP_ARRANGE_PADDING(){ return SMART_GROUP_ARRANGE_PADDING; },
        get SMART_GROUP_ARRANGE_GAP(){ return SMART_GROUP_ARRANGE_GAP; },
        get SMART_GROUP_ARRANGE_HEADER(){ return SMART_GROUP_ARRANGE_HEADER; },
        escapeAttr, escapeHtml,
        mediaKindForItem, singleMediaHtml, imageResolutionBadgeHtml, thumbMediaHtml,
        mediaNodeDefaultScale, singleImageLayout, groupImageGridLayout,
        get SMART_GROUP_MAX_VISIBLE_ROWS(){ return SMART_GROUP_MAX_VISIBLE_ROWS; },
        get SMART_GROUP_LEGACY_HEIGHT(){ return SMART_GROUP_LEGACY_HEIGHT; },
        get MEDIA_GROUP_THUMB_BASE(){ return MEDIA_GROUP_THUMB_BASE; },
    });
    nodeOutputs?.registerDeps?.({
        getNodes: () => nodes,
        setNodes: v => { nodes = v; },
        getCanvas: () => canvas,
        downstreamNodesForId: id => cascade?.downstreamNodesForId?.(id),
        nodeRect, uid, addConnection,
        stripImageGenerationMeta, nowMs, tr,
        isHistoryGroupNode,
        get settings(){ return settings; },
        sizeForRun, parseSizeValue, isApiLikeEngine,
        singleImageLayout,
        promptInput, promptPlainText, promptHtmlWithMentionTokens,
        escapeHtml,
        connectInputNode, outgoingConnectionsFor,
        isSmartImageNode, cloneSmartNode, mediaNodeDefaultScale,
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get activeComposerSubject(){ return activeComposerSubject; },
        get lastComposerNodeId(){ return lastComposerNodeId; },
        set lastComposerNodeId(v){ lastComposerNodeId = v; },
        get smartLoopContext(){ return smartLoopContext; },
        get MEDIA_GROUP_DEFAULT_SCALE(){ return MEDIA_GROUP_DEFAULT_SCALE; },
        get MEDIA_NODE_DEFAULT_SCALE(){ return MEDIA_NODE_DEFAULT_SCALE; },
    });
    cascade?.registerDeps?.({
        getNodes: () => nodes,
        getCanvas: () => canvas,
        get smartCascadeRuns(){ return smartCascadeRuns; },
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        get smartLoopContext(){ return smartLoopContext; },
        set smartLoopContext(v){ smartLoopContext = v; },
        get smartCascadeRunning(){ return smartCascadeRunning; },
        set smartCascadeRunning(v){ smartCascadeRunning = v; },
        get smartCascadeActiveLoopId(){ return smartCascadeActiveLoopId; },
        set smartCascadeActiveLoopId(v){ smartCascadeActiveLoopId = v; },
        get smartCascadeStopRequested(){ return smartCascadeStopRequested; },
        set smartCascadeStopRequested(v){ smartCascadeStopRequested = v; },
        get smartCascadeRunPath(){ return smartCascadeRunPath; },
        set smartCascadeRunPath(v){ smartCascadeRunPath = v; },
        get smartCascadeSilentSelection(){ return smartCascadeSilentSelection; },
        set smartCascadeSilentSelection(v){ smartCascadeSilentSelection = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get activeComposerSubject(){ return activeComposerSubject; },
        set activeComposerSubject(v){ activeComposerSubject = v; },
        get lastComposerNodeId(){ return lastComposerNodeId; },
        set lastComposerNodeId(v){ lastComposerNodeId = v; },
        get comfyWorkflows(){ return comfyWorkflows; },
        get comfyInstanceCount(){ return comfyInstanceCount; },
        runBtn, cascadeRunBtn, composer, promptInput,
        get MEDIA_GROUP_DEFAULT_SCALE(){ return MEDIA_GROUP_DEFAULT_SCALE; },
        get MEDIA_NODE_DEFAULT_SCALE(){ return MEDIA_NODE_DEFAULT_SCALE; },
        inputNodesFor,
        promptInputNodesFor: node => promptReq?.promptInputNodesFor?.(node),
        workflowInputNodesFor,
        upstreamNodesForKinds,
        directImageInputsFor,
        directImageInputsForKinds,
        upstreamLoopPromptNodesFor,
        isSmartImageNode,
        isHistoryGroupNode,
        smartImageUsesWorkflowInput,
        smartLoopCount,
        nodeRect, uid, cloneSmartNode, addConnection,
        selectedNode,
        tr, trf, toast, escapeHtml, refreshIcons, render,
        savePromptDraftForCurrent, cloneSmartSettings, pushUndo, scheduleSave, saveCanvas,
        refreshConnectionLayer, updateComposer,
        outputImagesForNode, defaultReferenceImagesFor, selfReferenceImagesForNode,
        buildPromptRequestForNode: (...args) => promptReq?.buildPromptRequestForNode?.(...args),
        smartSettingsForNode, validOutpaintSize, rememberRecentSmartSettings,
        isApiLikeEngine,
        runApiGeneration: (...args) => window.SmartCanvasGeneration?.runApiGeneration?.(...args),
        runApiVideoGeneration: (...args) => window.SmartCanvasGeneration?.runApiVideoGeneration?.(...args),
        pollSmartCanvasTask: (...args) => window.SmartCanvasGeneration?.pollSmartCanvasTask?.(...args),
        runRunningHubGeneration: (...args) => window.SmartCanvasGeneration?.runRunningHubGeneration?.(...args),
        runModelscopeGeneration: (...args) => window.SmartCanvasGeneration?.runModelscopeGeneration?.(...args),
        resultMediaUrls, mediaKindForUrls, imageRefsOnly, videoRefsOnly, audioRefsOnly,
        comfyNameForRef: (...args) => window.SmartCanvasGeneration?.comfyNameForRef?.(...args),
        comfyFieldKind, comfyRandomEnabledField, smartComfyRandomActiveFor, smartComfyRandomValue,
        stripImageGenerationMeta,
        replaceOutputsToNodeWithHistory: (...args) => nodeOutputs?.replaceOutputsToNodeWithHistory?.(...args),
        addSmartGenerationLog: (...a) => window.SmartCanvasGenerationLog?.addSmartGenerationLog?.(...a),
        smartRunSnapshot: (...a) => window.SmartCanvasGenerationLog?.smartRunSnapshot?.(...a), nowMs, attachRunMeta,
        cleanHistoryImages: (...args) => nodeOutputs?.cleanHistoryImages?.(...args),
        ensureHistoryGroupForNode: (...args) => nodeOutputs?.ensureHistoryGroupForNode?.(...args),
        resumeSmartPendingNode: (...args) => window.SmartCanvasGeneration?.resumeSmartPendingNode?.(...args),
        isVideoMediaItem,
    });
    window.SmartCanvasComposerInputThumbs?.registerDeps?.({
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        inputThumbsRow,
        activeComposerNode,
        selectedNode,
        mediaKindForItem,
        inputRefKey: (...a) => window.SmartCanvasPromptRequest?.inputRefKey?.(...a),
        closeMentionPicker: (...a) => window.SmartCanvasMentionPicker?.closeMentionPicker?.(...a),
        toggleAssetMentionPickerFromThumbs: (...a) => window.SmartCanvasMentionPicker?.toggleAssetMentionPickerFromThumbs?.(...a),
        isSupportedUploadFile,
        uploadFiles,
        mediaKindForFile,
        createImageNodeAt,
        nodeRect,
        connectInputNode,
        render,
        updateComposer,
        toast,
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        pushUndo,
        renderInputThumbsRow: (...a) => window.SmartCanvasComposer?.renderInputThumbsRow?.(...a),
        scheduleSave,
    });
    window.SmartCanvasNodeDelete?.registerDeps?.({
        getNodes: () => nodes,
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get canvas(){ return canvas; },
        get undoSuppressed(){ return undoSuppressed; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get saveTimer(){ return saveTimer; },
        set saveTimer(v){ saveTimer = v; },
        pushUndo,
        isHistoryGroupNode: (...a) => window.SmartCanvasNodeModel?.isHistoryGroupNode?.(...a),
        historyGroupForNode: (...a) => window.SmartCanvasNodeMeta?.historyGroupForNode?.(...a),
        render, scheduleSave, tr,
        saveCanvas: () => SmartCanvasPersistence.saveCanvas(),
    });
    window.SmartCanvasAgentActions?.registerDeps?.({
        getNodes: () => nodes,
        get canvas(){ return canvas; },
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get undoSuppressed(){ return undoSuppressed; },
        set undoSuppressed(v){ undoSuppressed = v; },
        viewportCenter,
        pushUndo,
        createNewSmartCanvas,
        scheduleSave,
        createPromptNode,
        createLoopNode,
        createImageNodeAt,
        addConnection,
        deleteNode,
        render,
        setPromptDraftForNode,
        updateComposer,
        runGeneration,
        get PANORAMA_RATIO_PRESETS(){ return PANORAMA_RATIO_PRESETS; },
        displayBoxFromNaturalSize,
        uid,
        get MEDIA_NODE_DEFAULT_SCALE(){ return MEDIA_NODE_DEFAULT_SCALE; },
        nowMs,
        refreshRunTimerPills,
        nodeRect,
        animateViewportTo,
        shell,
        viewport,
    });
    window.SmartCanvasNodeMerge?.registerDeps?.({
        getNodes: () => nodes,
        smartPendingTasks: (...a) => window.SmartCanvasGeneration?.smartPendingTasks?.(...a),
        nowMs,
        get smartNodeRunTokens(){ return smartNodeRunTokens; },
        downstreamImageTargetsFor: (...a) => window.SmartCanvasCascade?.downstreamImageTargetsFor?.(...a),
        isSmartImageNode: (...a) => window.SmartCanvasNodeModel?.isSmartImageNode?.(...a),
        isHistoryGroupNode: (...a) => window.SmartCanvasNodeModel?.isHistoryGroupNode?.(...a),
        successfulRecentComfyLogOutputs: (...a) => window.SmartCanvasGenerationLog?.successfulRecentComfyLogOutputs?.(...a),
        mediaKindForUrls: (...a) => window.SmartCanvasMediaLayout?.mediaKindForUrls?.(...a),
        stripImageGenerationMeta: (...a) => window.SmartCanvasNodeOutputs?.stripImageGenerationMeta?.(...a),
        mediaNodeDefaultScale: (...a) => window.SmartCanvasMediaLayout?.mediaNodeDefaultScale?.(...a),
    });
    window.SmartCanvasWorkflowImport?.registerDeps?.({
        get canvas(){ return canvas; },
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        pushUndo,
        viewportCenter: (...a) => window.SmartCanvasViewport?.viewportCenter?.(...a),
        serializableSmartNode,
        selectedNodeIds: (...a) => window.SmartCanvasNodeSelection?.selectedNodeIds?.(...a),
        uid,
        normalizeLegacySmartNode: (...a) => window.SmartCanvasNodeModel?.normalizeLegacySmartNode?.(...a),
        get selectedIds(){ return selectedIds; },
        set selectedIds(v){ selectedIds = v; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        get activeComposerSubject(){ return activeComposerSubject; },
        set activeComposerSubject(v){ activeComposerSubject = v; },
        render, scheduleSave, toast,
        toggleAssetLibrary: (...a) => window.SmartCanvasAssetLibrary?.toggleAssetLibrary?.(...a),
        refreshIcons,
        selectedSmartWorkflowPayload,
        smartWorkflowTransferSub, smartWorkflowTransferModal,
        smartWorkflowExportMeta,
        responseErrorMessage: smartResponseErrorMessage,
        closeSmartWorkflowTransferModal, updateSmartWorkflowTransferMeta,
        downloadBlob: (...a) => window.SmartCanvasMediaDownload?.downloadBlob?.(...a),
    });
    window.SmartCanvasGenerationLog?.registerDeps?.({
        get canvas(){ return canvas; },
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get settings(){ return settings; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get selectedImage(){ return selectedImage; },
        set selectedImage(v){ selectedImage = v; },
        smartLogList, smartLogModal, smartShortcutModal,
        tr, uid, scheduleSave, escapeHtml, escapeAttr, formatRunDuration, refreshIcons,
        cloneSmartSettings, isApiLikeEngine, sizeForRun,
        videoProviderById, apiProviderById,
        openImageEditor: (...a) => window.SmartCanvasImageEdit?.openImageEditor?.(...a),
        outputUrlLooksVideo: (...a) => window.SmartCanvasMediaLayout?.outputUrlLooksVideo?.(...a),
        copyMediaSizeFields: (...a) => window.SmartCanvasMediaLayout?.copyMediaSizeFields?.(...a),
        normalizedSizeLabel: (...a) => window.SmartCanvasMediaLayout?.normalizedSizeLabel?.(...a),
        imageResolutionLabel: (...a) => window.SmartCanvasMediaLayout?.imageResolutionLabel?.(...a),
    });
    window.SmartCanvasGeneration?.registerDeps?.({
        getNodes: () => nodes,
        get settings(){ return settings; },
        set settings(v){ settings = v; },
        get nodes(){ return nodes; },
        set nodes(v){ nodes = v; },
        get canvas(){ return canvas; },
        get selectedId(){ return selectedId; },
        set selectedId(v){ selectedId = v; },
        get undoSuppressed(){ return undoSuppressed; },
        set undoSuppressed(v){ undoSuppressed = v; },
        get smartLoopContext(){ return smartLoopContext; },
        get runBtn(){ return runBtn; },
        get comfyWorkflows(){ return comfyWorkflows; },
        MS_GEN_MODELS,
        SMART_REFERENCE_IMAGE_MAX,
        selectedNode,
        toast,
        tr,
        render,
        scheduleSave,
        pushUndo,
        cloneSmartSettings,
        smartSettingsForNode,
        buildPromptRequestForNode: (...args) => promptReq?.buildPromptRequestForNode?.(...args),
        isApiLikeEngine,
        effectiveApiRunCount,
        smartVideoGenerationCount,
        videoModelCapabilities,
        videoModelOptions,
        currentVideoReferenceMode,
        videoModeUsesSize,
        normalizeSmartVideoModeSettings,
        snapshotRunMeta,
        smartRunSnapshot: (...a) => window.SmartCanvasGenerationLog?.smartRunSnapshot?.(...a),
        rememberRecentSmartSettings,
        nowMs,
        persistActiveSmartSettings,
        smartImageUsesWorkflowInput,
        scaledImageSizeForSelectedNode,
        stripRunInputMeta,
        createPendingOutputBatchFromSource,
        createPendingOutputFromSource,
        pendingBoxSize,
        attachRunMeta,
        coolNodeRunningState,
        coolRunButton,
        restoreSourceVisualState,
        addSmartGenerationLog: (...a) => window.SmartCanvasGenerationLog?.addSmartGenerationLog?.(...a),
        finalizePendingNode,
        clearPromptInput,
        saveCanvas,
        finalizeOverwritePendingNode,
        restoreFromExtraction,
        clearNodeRunningState,
        normalizeSmartApiRefs,
        sizeForRunAsync,
        imageRefsOnly,
        videoRefsOnly,
        audioRefsOnly,
        syncVideoCountFromSettings,
        smartResponseErrorMessage,
        shouldSerializeSmartVideoRequests,
        resultMediaUrls,
        comfyFieldKind,
        comfyRandomEnabledField,
        smartComfyRandomActive,
        smartComfyRandomValue,
        mediaKindForUrls,
        createNode,
        nodeRect,
        addConnection,
        stripImageGenerationMeta,
        mediaNodeDefaultScale,
        ensureTypedPlaceholder,
        apiImageSize,
        parseSizeValue,
        urlToBase64,
        modelscopeImageModels,
        selectedRunningHubRef,
        rhActiveFields,
        rhMediaForRun,
        rhBuildNodeInfoList,
        rhBuildWorkflowRequestExtras,
        createSmartComfyTask: (...a) => window.SmartCanvasGeneration?.createSmartComfyTask?.(...a),
        waitSmartComfyTaskResult: (...a) => window.SmartCanvasGeneration?.waitSmartComfyTaskResult?.(...a),
        fetchJimengQuery: (...a) => window.SmartCanvasGeneration?.fetchJimengQuery?.(...a),
        extractUpstreamTaskId,
        providerIdForSmartTask,
        smartRecoverableImageTask: (...a) => window.SmartCanvasNodeToolbar?.smartRecoverableImageTask?.(...a),
        setNodeJimengPending: (...a) => window.SmartCanvasGeneration?.setNodeJimengPending?.(...a),
        jimengQueueText: (...a) => window.SmartCanvasGeneration?.jimengQueueText?.(...a),
        activeComposerNode,
        selectedNode,
        visibleReferenceImagesFor: (...a) => window.SmartCanvasReferenceImages?.visibleReferenceImagesFor?.(...a),
        nowMs,
    });

    window.SmartCanvasImageGridJoin?.registerDeps?.({
        getNodes: () => nodes,
        currentEditImage,
        imageForDisplay,
        mediaKindForItem,
        isSmartGroupNode,
        smartGroupImageRefs,
        displayMediaUrl,
        proxiedMediaUrl,
        uploadCroppedBlob: (...args) => window.SmartCanvasImageEdit?.uploadCroppedBlob?.(...args),
        closeImageEditor: (...args) => window.SmartCanvasImageEdit?.closeImageEditor?.(...args),
        openImageEditor: (...args) => window.SmartCanvasImageEdit?.openImageEditor?.(...args),
        setImageEditMode: (...args) => window.SmartCanvasImageEdit?.setImageEditMode?.(...args),
        setGridOperationMode,
        getGridOperationMode,
        imageEditModal,
        get imageEditMode(){ return imageEditMode; },
        get imageEditZoom(){ return imageEditZoom; },
        refreshGridSplitPreview,
        nodeRect,
        createImageNodeAt,
        render,
        scheduleSave,
        toast,
        safeExportFileName,
        downloadNameForMediaItem,
    });

}
async function bootstrapSmartCanvas(){
    registerSmartCanvasModuleDeps();
    if(window.lucide){
        try { lucide.createIcons({ root: document.getElementById('shell') || document.body }); }
        catch(_e) { try { lucide.createIcons(); } catch(__e) {} }
    }
    applyTheme(localStorage.getItem('studio_theme') || localStorage.getItem('canvas_theme') || 'dark');
    loadPromptPresets();
    loadPromptTemplateGroups();
    loadPromptTemplateOverrides();
    connectAssetLibrarySyncSocket();
    // Fast path: config + canvas first so clicks work before optional libraries finish loading.
    await loadConfig();
    await loadCanvas();
    SmartCanvasHistory?.notifyShellCanvasProject?.(false);
    syncApiKindToggleVisibility();
    if(!canvasHydrated) render();
    SmartCanvasUiBindings?.bindCanvas?.(buildSmartCanvasUiContext());
    SmartCanvasUiBindings?.bindChrome?.(buildSmartCanvasUiContext());
    // Build the blank-canvas creation menu away from the user's first
    // double-click. This also converts its icons once instead of on every open.
    const prepareCreateMenu = () => window.SmartCanvasPortLinkMenu?.prepare?.();
    if(window.requestIdleCallback) requestIdleCallback(prepareCreateMenu, {timeout:600});
    else setTimeout(prepareCreateMenu, 0);
    void loadPromptTemplates().catch(err => console.warn('[loadPromptTemplates]', err));
    void loadAssetLibrary().catch(err => console.warn('[loadAssetLibrary]', err));
    if(window.StudioI18n) window.StudioI18n.apply();
    if(window.lucide) lucide.createIcons();
}
function ensureSmartCanvasUiBindings(){
    try {
        const ctx = buildSmartCanvasUiContext();
        SmartCanvasUiBindings?.bindCanvas?.(ctx);
        SmartCanvasUiBindings?.bindChrome?.(ctx);
    } catch(err) {
        console.error('[ensureSmartCanvasUiBindings]', err);
    }
}
function scheduleSmartCanvasBootstrap(){
    if(scheduleSmartCanvasBootstrap.started) return;
    scheduleSmartCanvasBootstrap.started = true;
    bootstrapSmartCanvas()
        .catch(err => console.error('[bootstrapSmartCanvas]', err))
        .finally(() => ensureSmartCanvasUiBindings());
}
/* === restored upstream functions === */
function clearSmartNodeBusyState(node){ return window.SmartCanvasNodeMerge?.clearSmartNodeBusyState?.(node); }
function clearSourceBusyStateIfDownstreamDone(sourceNode, options={}){ return window.SmartCanvasNodeMerge?.clearSourceBusyStateIfDownstreamDone?.(sourceNode, options); }
function comfyParamsFromWorkflowValues(config, values={}){ return window.SmartCanvasComfyParams?.comfyParamsFromWorkflowValues?.(config, values); }
function createSmartComfyTask(payload){ return window.SmartCanvasGeneration?.createSmartComfyTask?.(payload); }
function currentGridJoinItems(...args){ return window.SmartCanvasImageGridJoin?.currentGridJoinItems?.(...args); }
function ensureGridJoinLayout(rows=null, cols=null){ return window.SmartCanvasImageGridJoin?.ensureGridJoinLayout?.(rows, cols); }
function exportSelectedSmartWorkflow(includeResources=false){ return window.SmartCanvasWorkflowImport?.exportSelectedSmartWorkflow?.(includeResources); }
function fetchImageTaskQuery(providerId, taskId){ return window.SmartCanvasGeneration?.fetchImageTaskQuery?.(providerId, taskId); }
function fetchJimengQuery(submitId, kind){ return window.SmartCanvasGeneration?.fetchJimengQuery?.(submitId, kind); }
function gridJoinBaseCellSize(items){ return window.SmartCanvasImageGridJoin?.gridJoinBaseCellSize?.(items); }
function gridJoinVisualOrder(layout){ return window.SmartCanvasImageGridJoin?.gridJoinVisualOrder?.(layout); }
function handleCanvasUpdatedMessage(data={}){ return window.SmartCanvasPersistence?.handleCanvasUpdatedMessage?.(data); }
function handleJimengPendingSignal(node, e){ return window.SmartCanvasGeneration?.handleJimengPendingSignal?.(node, e); }
function hideCompletedRunTimers(...args){ return window.SmartCanvasRunState?.hideCompletedRunTimers?.(...args); }
function imageTaskRecoverBodyHtml(node, task, layout){ return window.SmartCanvasRunState?.imageTaskRecoverBodyHtml?.(node, task, layout); }
function importSmartWorkflowFile(file){ return window.SmartCanvasWorkflowImport?.importSmartWorkflowFile?.(file); }
function insertSmartWorkflowIntoCanvas(imported){ return window.SmartCanvasWorkflowImport?.insertSmartWorkflowIntoCanvas?.(imported); }
function isGptImageAutoSizeModel(model){ return window.SmartCanvasComposerSettings?.isGptImageAutoSizeModel?.(model); }
function isSmartGroupCompactMember(node){ return window.SmartCanvasSmartGroup?.isSmartGroupCompactMember?.(node); }
function isSmartGroupNode(node){ return window.SmartCanvasSmartGroup?.isSmartGroupNode?.(node); }
function nonPreviewOutputImages(images=[]){ return window.SmartCanvasNodeMerge?.nonPreviewOutputImages?.(images); }
function renderGridJoinPreview(...args){ return window.SmartCanvasImageGridJoin?.renderGridJoinPreview?.(...args); }
function resetGridJoinLayout(...args){ return window.SmartCanvasImageGridJoin?.resetGridJoinLayout?.(...args); }
function rhActiveFields(sourceSettings=settings){ return window.SmartCanvasRunningHub?.rhActiveFields?.(sourceSettings); }
function rhCurrentKind(sourceSettings=settings){ return window.SmartCanvasRunningHub?.rhCurrentKind?.(sourceSettings); }
function runSmartGroupToolbarAction(nodeId, action){ return window.SmartCanvasNodeToolbar?.runSmartGroupToolbarAction?.(nodeId, action); }
function runSmartNodeToolbarAction(nodeId, action){ return window.SmartCanvasNodeToolbar?.runSmartNodeToolbarAction?.(nodeId, action); }
function scaleSmartGroupMemberToZoom(group, member, zoom){ return window.SmartCanvasSmartGroup?.scaleSmartGroupMemberToZoom?.(group, member, zoom); }
function scheduleCanvasMergeReload(delay=200){ return window.SmartCanvasPersistence?.scheduleCanvasMergeReload?.(delay); }
function selectedSmartWorkflowPayload(...args){ return window.SmartCanvasWorkflowImport?.selectedSmartWorkflowPayload?.(...args); }
function setGridJoinOutputSize(size){ return window.SmartCanvasImageGridJoin?.setGridJoinOutputSize?.(size); }
function smartNodeHasCompletedResult(node){ return window.SmartCanvasNodeMerge?.smartNodeHasCompletedResult?.(node); }
function smartNodeHasDisplayResult(node){ return window.SmartCanvasNodeMerge?.smartNodeHasDisplayResult?.(node); }
function smartNodeInFlight(node){ return window.SmartCanvasNodeMerge?.smartNodeInFlight?.(node); }
function smartNodeToolbarHtml(node){ return window.SmartCanvasNodeToolbar?.smartNodeToolbarHtml?.(node); }
function smartNodeToolbarImageIndex(node){ return window.SmartCanvasNodeToolbar?.smartNodeToolbarImageIndex?.(node); }
function smartOriginalMediaUrl(itemOrUrl){ return window.SmartCanvasMediaLayout?.smartOriginalMediaUrl?.(itemOrUrl); }
function sortRunningHubFields(fields){ return window.SmartCanvasRunningHub?.sortRunningHubFields?.(fields); }
function syncGridJoinSizeControls(...args){ return window.SmartCanvasImageGridJoin?.syncGridJoinSizeControls?.(...args); }
function isSmartImageNode(node){
    return Boolean(node && (node.type === 'smart-image' || !node.type));
}
function isInlineVideoActive(img){
    return Boolean(img && img._inlineVideoActive);
}
function rememberInlineVideoActivations(){
    world.querySelectorAll('.image-node [data-image-index] video[data-inline-video-active="1"]').forEach(video => {
        const nodeEl = video.closest('.image-node');
        const itemEl = video.closest('[data-image-index]');
        const node = nodes.find(n => n.id === nodeEl?.dataset.id);
        const index = Number(itemEl?.dataset.imageIndex ?? 0);
        const image = node?.images?.[index];
        if(image && mediaKindForItem(image) === 'video') image._inlineVideoActive = true;
    });
}
function scheduleInteractionLayerRefresh(){
    if(interactionLayerRaf) return;
    interactionLayerRaf = requestAnimationFrame(() => {
        interactionLayerRaf = 0;
        refreshConnectionLayer();
        renderMinimap();
    });
}
function serializableSmartNode(node){
    const base = JSON.parse(JSON.stringify(node || {}));
    const copy = normalizeLegacySmartNode(base) || {};
    if(Array.isArray(copy.images)) copy.images = copy.images.map(img => mediaItemForStorage(stripImageGenerationMeta(img))).filter(Boolean);
    if(copy.runSettings) copy.runSettings = settingsForStorage(copy.runSettings);
    copy.running = false;
    copy.pending = 0;
    copy.queued = false;
    copy.jimengPending = null;
    delete copy.pendingTasks;
    delete copy._dom;
    return copy;
}
function absorbImageNodeIntoSmartGroup(group, child){ return window.SmartCanvasSmartGroup?.absorbImageNodeIntoSmartGroup?.(group, child); }
function activeAssetTabCategory(){ return window.SmartCanvasAssetLibrary?.activeAssetTabCategory?.(); }
function activeWorkflowAssetCategory(){ return window.SmartCanvasAssetLibrary?.activeWorkflowAssetCategory?.(); }
function addCreatedNodeToMenuGroup(node){ return window.SmartCanvasSmartGroup?.addCreatedNodeToMenuGroup?.(node); }
function addDraggedNodeToSmartGroup(draggedNode, group){ return window.SmartCanvasSmartGroup?.addDraggedNodeToSmartGroup?.(draggedNode, group); }
function addDraggedNodesToSmartGroup(draggedNodes, group){ return window.SmartCanvasSmartGroup?.addDraggedNodesToSmartGroup?.(draggedNodes, group); }
async function addFilesToLocalAssetLibrary(files=[]){ return window.SmartCanvasAssetLibrary?.addFilesToLocalAssetLibrary?.(files); }
async function addLocalPathsToLocalAssetLibrary(paths=[]){ return window.SmartCanvasAssetLibrary?.addLocalPathsToLocalAssetLibrary?.(paths); }
function addManualReferenceToSelectedNode(img){ return window.SmartCanvasComposerInputThumbs?.addManualReferenceToSelectedNode?.(img); }
function addNodeToSmartGroup(group, child){ return window.SmartCanvasSmartGroup?.addNodeToSmartGroup?.(group, child); }
async function addUrlItemsToLocalAssetLibrary(items=[]){ return window.SmartCanvasAssetLibrary?.addUrlItemsToLocalAssetLibrary?.(items); }
function appendLoopOutputsToNode(node, additions, kind='image', ctx=smartLoopContext){ return window.SmartCanvasNodeOutputs?.appendLoopOutputsToNode?.(node, additions, kind, ctx); }
function applyGridJoinPreset(rows, cols){ return window.SmartCanvasImageGridJoin?.applyGridJoinPreset?.(rows, cols); }
async function applyImageGridJoin(){ return window.SmartCanvasImageGridJoin?.applyImageGridJoin?.(); }
function applyJimengQueryResult(node, data){ return window.SmartCanvasGeneration?.applyJimengQueryResult?.(node, data); }
function arrangeSmartGroupMembers(group, options={}){ return window.SmartCanvasSmartGroup?.arrangeSmartGroupMembers?.(group, options); }
function assetLibraryIsLocal(){ return window.SmartCanvasAssetLibrary?.assetLibraryIsLocal?.(); }
function assetRegisteredUris(item){ return window.SmartCanvasAssetLibrary?.assetRegisteredUris?.(item); }
function assetSmartClassEntries(){ return window.SmartCanvasAssetLibrary?.assetSmartClassEntries?.(); }
function assetSmartClassKey(entry){ return window.SmartCanvasAssetLibrary?.assetSmartClassKey?.(entry); }
function assetSmartClassOptionId(entry){ return window.SmartCanvasAssetLibrary?.assetSmartClassOptionId?.(entry); }
function beginGridJoinDrag(event){ return window.SmartCanvasImageGridJoin?.beginGridJoinDrag?.(event); }
function bindInputThumbReferenceActions(){ return window.SmartCanvasComposerInputThumbs?.bindInputThumbReferenceActions?.(); }
function bindSmartPreviewImageFallbacks(root=document){ return window.SmartCanvasAssetLibrary?.bindSmartPreviewImageFallbacks?.(root); }
function bindWorkflowAssetItemEvents(){ return window.SmartCanvasAssetLibrary?.bindWorkflowAssetItemEvents?.(); }
function canGridJoinCurrentNode(){ return window.SmartCanvasImageGridJoin?.canGridJoinCurrentNode?.(); }
function canvasListUrlForProject(projectId){
    const pid = rememberCanvasListProject(projectId);
    return `/static/canvas-list.html?project=${encodeURIComponent(pid)}`;
}
function cleanupDetachedRunInputRefs(){ return window.SmartCanvasConnectionGraph?.cleanupDetachedRunInputRefs?.(); }
function cleanupSmartLogPreviewNode(){ return window.SmartCanvasGenerationLog?.cleanupSmartLogPreviewNode?.(); }
function clearCompletedNodeBusyStates(){ return window.SmartCanvasNodeMerge?.clearCompletedNodeBusyStates?.(); }
function clearCompletedSourceBusyStates(){ return window.SmartCanvasNodeMerge?.clearCompletedSourceBusyStates?.(); }
function clearDetachedRunInputRefs(node){ return window.SmartCanvasConnectionGraph?.clearDetachedRunInputRefs?.(node); }
function clearInputThumbDropMarkers(){ return window.SmartCanvasComposerInputThumbs?.clearInputThumbDropMarkers?.(); }
function closeSmartLogLightbox(){ return window.SmartCanvasGenerationLog?.closeSmartLogLightbox?.(); }
function clearVolcengineSelectionOutsideVolcengine(target=settings){ return window.SmartCanvasComposerParams?.clearVolcengineSelectionOutsideVolcengine?.(target); }
function completeSmartNodeWithImages(node, images){ return window.SmartCanvasNodeMerge?.completeSmartNodeWithImages?.(node, images); }
function completedDownstreamOutputForNode(sourceNode){ return window.SmartCanvasNodeMerge?.completedDownstreamOutputForNode?.(sourceNode); }
function copyMediaSizeFields(source, target={}){ return window.SmartCanvasMediaLayout?.copyMediaSizeFields?.(source, target); }
function closeSmartWorkflowTransferModal(){ return window.SmartCanvasWorkflowImport?.closeSmartWorkflowTransferModal?.(); }
function currentAssetTabCategories(){ return window.SmartCanvasAssetLibrary?.currentAssetTabCategories?.(); }
function currentAssetTabIsWorkflow(){ return window.SmartCanvasAssetLibrary?.currentAssetTabIsWorkflow?.(); }
async function deleteLocalAssetFromPanel(itemId){ return window.SmartCanvasAssetLibrary?.deleteLocalAssetFromPanel?.(itemId); }
function disconnectConnections(spec){ return window.SmartCanvasConnectionGraph?.disconnectConnections?.(spec); }
function downloadBlob(blob, filename){ return window.SmartCanvasMediaDownload?.downloadBlob?.(blob, filename); }
function downloadSmartGroupImages(group){ return window.SmartCanvasMediaDownload?.downloadSmartGroupImages?.(group); }
function drawImageCover(ctx, img, dx, dy, dw, dh){ return window.SmartCanvasImageGridJoin?.drawImageCover?.(ctx, img, dx, dy, dw, dh); }
function duplicateSmartNodeMediaToCanvas(node, imageIndex){ return window.SmartCanvasNodeFactory?.duplicateSmartNodeMediaToCanvas?.(node, imageIndex); }
function endGridJoinDrag(event){ return window.SmartCanvasImageGridJoin?.endGridJoinDrag?.(event); }
function createSmartGroupNode(x, y, options={}){ return window.SmartCanvasSmartGroup?.createSmartGroupNode?.(x, y, options); }
function currentAssetSourceLibraries(){ return window.SmartCanvasAssetLibrary?.currentAssetSourceLibraries?.(); }
function extractUpstreamTaskId(text){
    const match = String(text || '').match(/(?:task_id|taskId|task id)\s*[=:：]\s*([A-Za-z0-9_.:-]+)/i);
    return match ? match[1] : '';
}
const activeJimengPolls = new Set();
const JIMENG_POLL_INTERVAL = 60000;
const JIMENG_POLL_MAX = 1440;
function filterJimengImageModels(models){ return window.SmartCanvasProviderSelection?.filterJimengImageModels?.(models); }
function filterJimengVideoModels(models){ return window.SmartCanvasProviderSelection?.filterJimengVideoModels?.(models); }
function gridGapInputValue(){ return window.SmartCanvasImageGridJoin?.gridGapInputValue?.(); }
function gridJoinAutoDims(count){ return window.SmartCanvasImageGridJoin?.gridJoinAutoDims?.(count); }
function gridJoinCanvasSize(layout){ return window.SmartCanvasImageGridJoin?.gridJoinCanvasSize?.(layout); }
function gridJoinDragTarget(){ return window.SmartCanvasImageGridJoin?.gridJoinDragTarget?.(); }
function gridJoinItemDisplaySize(entry, cell){ return window.SmartCanvasImageGridJoin?.gridJoinItemDisplaySize?.(entry, cell); }
function gridJoinNaturalSize(entry){ return window.SmartCanvasImageGridJoin?.gridJoinNaturalSize?.(entry); }
function defaultSmartApiResolution(model){ return window.SmartCanvasComposerParams?.defaultSmartApiResolution?.(model); }
function exitZoomPreviewToNode(nodeId){ return window.SmartCanvasViewport?.exitZoomPreviewToNode?.(nodeId); }
function isSmartLoopDefaultPrompt(text){ return window.SmartCanvasSmartLoop?.isSmartLoopDefaultPrompt?.(text); }
function isSmartPreviewImage(img){
    return img?.tagName?.toLowerCase?.() === 'img'
        && img.dataset?.previewSrc
        && img.dataset?.originalSrc
        && img.dataset.previewSrc !== img.dataset.originalSrc
        && img.getAttribute('src') !== img.dataset.originalSrc;
}
function isSmartRunnableNode(node){
    return Boolean(isSmartImageNode(node) || isSmartGroupNode(node) || window.SmartCanvasComposerText?.isTextSubject?.(node));
}
function jimengImageEditMode(){ return window.SmartCanvasGeneration?.jimengImageEditMode?.(); }
function jimengPendingBodyHtml(node, layout){ return window.SmartCanvasGeneration?.jimengPendingBodyHtml?.(node, layout); }
function jimengQueueText(queueInfo){ return window.SmartCanvasGeneration?.jimengQueueText?.(queueInfo); }
function jimengVideoCommand(){ return window.SmartCanvasGeneration?.jimengVideoCommand?.(); }
function liveSmartNode(node){
    if(!node?.id) return node;
    return nodes.find(n => n.id === node.id) || node;
}
function loadGridJoinImage(entry){ return window.SmartCanvasImageGridJoin?.loadGridJoinImage?.(entry); }
function loadSmartOriginalImageDimensions(url){ return window.SmartCanvasReferenceImages?.loadSmartOriginalImageDimensions?.(url); }
function localAssetFolderCategories(){ return window.SmartCanvasAssetLibrary?.localAssetFolderCategories?.(); }
function localAssetFolderPath(){ return window.SmartCanvasAssetLibrary?.localAssetFolderPath?.(); }
function manualReferenceImagesFor(node){ return window.SmartCanvasReferenceImages?.manualReferenceImagesFor?.(node); }
function markSmartNodeComplete(node, meta=null){ return window.SmartCanvasNodeMerge?.markSmartNodeComplete?.(node, meta); }
function mediaLayoutSize(img){ return window.SmartCanvasMediaLayout?.mediaLayoutSize?.(img); }
function mentionOptionMediaHtml(img){ return window.SmartCanvasMentionPicker?.mentionOptionMediaHtml?.(img); }
function mentionTokenMediaHtml(img, kind=mediaKindForItem(img)){ return window.SmartCanvasMentionPicker?.mentionTokenMediaHtml?.(img, kind); }
async function mergeReloadCanvasNow(){ return window.SmartCanvasPersistence?.mergeReloadCanvasNow?.(); }
function mergeSmartConnections(localConns, remoteConns, nodeIds){ return window.SmartCanvasNodeMerge?.mergeSmartConnections?.(localConns, remoteConns, nodeIds); }
function mergeSmartImageLists(localImgs, remoteImgs){ return window.SmartCanvasNodeMerge?.mergeSmartImageLists?.(localImgs, remoteImgs); }
function mergeSmartNode(local, remote){ return window.SmartCanvasNodeMerge?.mergeSmartNode?.(local, remote); }
function mergeSmartNodeLists(localNodes, remoteNodes){ return window.SmartCanvasNodeMerge?.mergeSmartNodeLists?.(localNodes, remoteNodes); }
function migrateSmartGroupImageMembers(){ return window.SmartCanvasSmartGroup?.migrateSmartGroupImageMembers?.(); }
function modelscopeImageModels(){ return window.SmartCanvasProviderSelection?.modelscopeImageModels?.(); }
function modelscopeProvider(){ return window.SmartCanvasProviderSelection?.modelscopeProvider?.(); }
function moveGridJoinDrag(event){ return window.SmartCanvasImageGridJoin?.moveGridJoinDrag?.(event); }
function inputThumbDropPlacement(el, event){ return window.SmartCanvasComposerInputThumbs?.inputThumbDropPlacement?.(el, event); }
function normalizeImportedSmartWorkflow(data){ return window.SmartCanvasWorkflowImport?.normalizeImportedSmartWorkflow?.(data); }
function normalizedSizeLabel(value){ return window.SmartCanvasMediaLayout?.normalizedSizeLabel?.(value); }
function rerouteSmartConnections(fromId, toId){ return window.SmartCanvasSmartGroup?.rerouteSmartConnections?.(fromId, toId); }
function openGroupGridJoin(group){ return window.SmartCanvasImageGridJoin?.openGroupGridJoin?.(group); }
function openGroupImagePreview(group, startNodeId, startIndex=0){ return window.SmartCanvasImageEdit?.openGroupImagePreview?.(group, startNodeId, startIndex); }
function openImagePreviewSmart(nodeId, imageIndex=0){ return window.SmartCanvasImageEdit?.openImagePreviewSmart?.(nodeId, imageIndex); }
function parseRunningHubEntryKey(value){ return window.SmartCanvasRunningHub?.parseRunningHubEntryKey?.(value); }
function pasteAssetsFromInbox(){ return window.SmartCanvasAssetLibrary?.pasteAssetsFromInbox?.(); }
function placeMentionPickerInComposerCard(){ return window.SmartCanvasMentionPicker?.placeMentionPickerInComposerCard?.(); }
function placeMentionPickerInPromptRow(){ return window.SmartCanvasMentionPicker?.placeMentionPickerInPromptRow?.(); }
function promptLlmInstructionHeight(node){ return window.SmartCanvasPromptLayout?.promptLlmInstructionHeight?.(node); }
function promptNodeLLMInputText(node, ctx=smartLoopContext){ return window.SmartCanvasPromptLayout?.promptNodeLLMInputText?.(node, ctx); }
function promptNodeMinHeight(node){ return window.SmartCanvasPromptLayout?.promptNodeMinHeight?.(node); }
function promptNodePromptItems(node){ return window.SmartCanvasPromptLayout?.promptNodePromptItems?.(node); }
function promptNodeUpstreamPromptItems(node, ctx=smartLoopContext){ return window.SmartCanvasPromptLayout?.promptNodeUpstreamPromptItems?.(node, ctx); }
function providerIdForSmartTask(node, task){
    return task?.providerId || node?.runSettings?.provider_id || settings.provider_id || 'comfly';
}
function fitSmartGroupFrameToMembers(group){ return window.SmartCanvasSmartGroup?.fitSmartGroupFrameToMembers?.(group); }
function cleanupEmptySmartGroups(){ return window.SmartCanvasSmartGroup?.cleanupEmptySmartGroups?.(); }
function pruneSmartGroupMembershipsForNode(node){ return window.SmartCanvasSmartGroup?.pruneSmartGroupMembershipsForNode?.(node); }
async function queryJimengNow(nodeId){ return window.SmartCanvasGeneration?.queryJimengNow?.(nodeId); }
async function querySmartImageTaskNow(nodeId, localTaskId){ return window.SmartCanvasGeneration?.querySmartImageTaskNow?.(nodeId, localTaskId); }
function readAssetInbox(){ return window.SmartCanvasAssetLibrary?.readAssetInbox?.(); }
function recoverStuckLoopOutputsFromLogs(){ return window.SmartCanvasNodeMerge?.recoverStuckLoopOutputsFromLogs?.(); }
function refreshPromptNodeSegmentsUi(el, node){ return window.SmartCanvasPromptLayout?.refreshPromptNodeSegmentsUi?.(el, node); }
function rememberCanvasListProject(projectId){
    const pid = projectId || 'default';
    try { localStorage.setItem(CANVAS_LIST_PROJECT_KEY, pid); } catch(e){}
    return pid;
}
function rememberRoundOutputs(ctx, node, outputs){
    if(!ctx || !node?.id || !Array.isArray(outputs)) return outputs || [];
    if(!ctx.roundOutputs || typeof ctx.roundOutputs.set !== 'function') ctx.roundOutputs = new Map();
    ctx.roundOutputs.set(node.id, outputs.filter(img => img?.url).map(img => ({...img})));
    return outputs;
}
function openSmartWorkflowTransferModal(){ return window.SmartCanvasWorkflowImport?.openSmartWorkflowTransferModal?.(); }
function resumeJimengPendingNodes(){
    nodes.filter(n => n && n.jimengPending && n.jimengPending.submitId).forEach(n => {
        n.jimengPending.querying = false;
        startJimengPoll(n);
    });
}
function rhEntryFields(entry){ return window.SmartCanvasRunningHub?.rhEntryFields?.(entry) ?? []; }
function removeManualReferenceFromSelectedNode(key){ return window.SmartCanvasComposerInputThumbs?.removeManualReferenceFromSelectedNode?.(key); }
function runningHubEntries(kind){ return window.SmartCanvasRunningHub?.runningHubEntries?.(kind); }
function runningHubEntryId(entry, kind){ return window.SmartCanvasRunningHub?.runningHubEntryId?.(entry, kind); }
function runningHubProvider(){ return window.SmartCanvasRunningHub?.runningHubProvider?.(); }
function runningHubRunNeedsPrompt(sourceSettings=settings){ return window.SmartCanvasRunningHub?.runningHubRunNeedsPrompt?.(sourceSettings) ?? true; }
function sameOrderedIds(a, b){
    if((a || []).length !== (b || []).length) return false;
    return (a || []).every((id, index) => id === b[index]);
}
function promptNodeSeparator(node){ return window.SmartCanvasPromptLayout?.promptNodeSeparator?.(node); }
function scheduleConnectionLayerRefresh(){
    if(connectionLayerRaf) return;
    connectionLayerRaf = requestAnimationFrame(refreshConnectionLayer);
}
let interactionLayerRaf = 0;
// 拖动/缩放节点时，每个 mousemove 都全量重建连线 SVG + 小地图会掉帧；
// 用 requestAnimationFrame 把它们合并成每帧最多刷新一次（节点本身的位移仍是即时的）。
function promptNodeSplitExtraHeight(node){ return window.SmartCanvasPromptLayout?.promptNodeSplitExtraHeight?.(node); }
function promptNodeSplitPreviewHeight(node){ return window.SmartCanvasPromptLayout?.promptNodeSplitPreviewHeight?.(node); }
function setGridJoinLayoutOrder(order, rows=null, cols=null, gapOverride=null){ return window.SmartCanvasImageGridJoin?.setGridJoinLayoutOrder?.(order, rows, cols, gapOverride); }
function promptNodeUpstreamPromptText(node, ctx=smartLoopContext){ return window.SmartCanvasPromptLayout?.promptNodeUpstreamPromptText?.(node, ctx); }
function promptTextItemsForNode(node, ctx=smartLoopContext){ return window.SmartCanvasPromptLayout?.promptTextItemsForNode?.(node, ctx); }
function setLocalAssetLibraryFromResponse(data){
    localAssetLibrary = {items:Array.isArray(data.items) ? data.items : localAssetLibrary.items, tree:data.tree || localAssetLibrary.tree};
}
function setNodeJimengPending(node, signal){ return window.SmartCanvasGeneration?.setNodeJimengPending?.(node, signal); }
function setPromptCaretToEnd(){
    if(!promptInput) return;
    promptInput.focus();
    const range = document.createRange();
    range.selectNodeContents(promptInput);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    mentionRange = range.cloneRange();
}
function smartActivateVideoPreview(target){
    return window.SmartCanvasMediaLayout?.smartActivateVideoPreview?.(target);
}
function smartGroupBodyHtml(node){ return window.SmartCanvasSmartGroup?.smartGroupBodyHtml?.(node); }
function smartGroupCompactMembers(node){ return window.SmartCanvasSmartGroup?.smartGroupCompactMembers?.(node); }
function smartGroupContainingNode(nodeId){ return window.SmartCanvasSmartGroup?.smartGroupContainingNode?.(nodeId); }
function smartGroupHitBounds(group){ return window.SmartCanvasSmartGroup?.smartGroupHitBounds?.(group); }
function smartGroupAtWorldPoint(wx, wy){ return window.SmartCanvasSmartGroup?.smartGroupAtWorldPoint?.(wx, wy); }
function smartGroupImageGridLayout(node){ return window.SmartCanvasSmartGroup?.smartGroupImageGridLayout?.(node); }
function smartGroupImageRefs(group){ return window.SmartCanvasSmartGroup?.smartGroupImageRefs?.(group); }
function smartGroupLayoutSize(node){ return window.SmartCanvasSmartGroup?.smartGroupLayoutSize?.(node); }
function smartGroupMembers(node){ return window.SmartCanvasSmartGroup?.smartGroupMembers?.(node); }
function smartGroupScopeId(nodeId){ return window.SmartCanvasSmartGroup?.smartGroupScopeId?.(nodeId); }
function smartGroupTargetForDraggedNode(draggedNode){ return window.SmartCanvasSmartGroup?.smartGroupTargetForDraggedNode?.(draggedNode); }
function smartGroupThumbLayout(node){ return window.SmartCanvasSmartGroup?.smartGroupThumbLayout?.(node); }
function smartGroupToolbarHtml(node){ return window.SmartCanvasSmartGroup?.smartGroupToolbarHtml?.(node); }
function smartGroupZoom(group){ return window.SmartCanvasSmartGroup?.smartGroupZoom?.(group); }
function smartLogOutputItem(output){ return window.SmartCanvasGenerationLog?.smartLogOutputItem?.(output); }
function smartLogSizeSummary(log, outputs=[]){ return window.SmartCanvasGenerationLog?.smartLogSizeSummary?.(log, outputs); }
function smartLoopDefaultPromptText(){ return window.SmartCanvasSmartLoop?.smartLoopDefaultPromptText?.(); }
function smartLoopRoundSettings(runSettings, ctx=smartLoopContext){ return window.SmartCanvasSmartLoop?.smartLoopRoundSettings?.(runSettings, ctx); }
function runningHubAllEntries(){ return window.SmartCanvasRunningHub?.runningHubAllEntries?.(); }
function smartRecoverableImageTask(node){ return window.SmartCanvasNodeToolbar?.smartRecoverableImageTask?.(node); }
function smartRunNeedsPrompt(sourceSettings=settings){ return window.SmartCanvasSmartLoop?.smartRunNeedsPrompt?.(sourceSettings); }
function startCanvasMetaPoll(){ return window.SmartCanvasPersistence?.startCanvasMetaPoll?.(); }
function successfulRecentComfyLogOutputs(sourceNodeId='', withinMs=30 * 60 * 1000){ return window.SmartCanvasGenerationLog?.successfulRecentComfyLogOutputs?.(sourceNodeId, withinMs); }
function runningHubEntryKey(kind, id){ return window.SmartCanvasRunningHub?.runningHubEntryKey?.(kind, id); }
function syncGridOperationControls(){ return window.SmartCanvasImageEdit?.syncGridOperationControls?.(); }
function runningHubEntryLabel(entry, kind){ return window.SmartCanvasRunningHub?.runningHubEntryLabel?.(entry, kind); }
function syncJimengModelPillForRefs(){ return window.SmartCanvasComposerParams?.syncJimengModelPillForRefs?.(); }
function syncJimengVideoModelPillForRefs(){ return window.SmartCanvasComposerParams?.syncJimengVideoModelPillForRefs?.(); }
function selectedRunningHubRef(sourceSettings=settings){ return window.SmartCanvasRunningHub?.selectedRunningHubRef?.(sourceSettings); }
function syncRunButtonState(node=selectedNode()){
    if(!runBtn) return;
    // 只在“当前选中节点自己”忙时禁用运行：节点正在生成/排队，或它本身是正在跑的循环。
    // 不再因为“画布上有任意循环/级联在跑”就全局禁用——跑循环时仍可对其他节点点生成。
    runBtn.disabled = !isSmartRunnableNode(node) || smartNodeInFlight(node) || smartCascadeIsLoopRunning(node?.id);
}
function syncSmartGroupMemberElements(group){ return window.SmartCanvasSmartGroup?.syncSmartGroupMemberElements?.(group); }
function toggleAssetMentionPickerFromThumbs(){ return window.SmartCanvasMentionPicker?.toggleAssetMentionPickerFromThumbs?.(); }
function updateImageResolutionBadgeElement(itemEl, img){ return window.SmartCanvasMediaLayout?.updateImageResolutionBadgeElement?.(itemEl, img); }
function updateSmartWorkflowTransferMeta(){ return window.SmartCanvasWorkflowImport?.updateSmartWorkflowTransferMeta?.(); }
function getGridOperationMode(){ return window.SmartCanvasImageEdit?.getGridOperationMode?.(); }
async function urlToBase64(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error(tr('smart.errImageRead'));
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
function setGridOperationMode(mode){ return window.SmartCanvasImageEdit?.setGridOperationMode?.(mode); }
function usedCanvasOutputUrls(){ return window.SmartCanvasNodeMerge?.usedCanvasOutputUrls?.(); }
function videoProviderPlatform(providerId){
    const p = (apiProviders || []).find(x => x.id === providerId);
    const proto = String(p?.protocol || '').toLowerCase();
    const base = String(p?.base_url || '').toLowerCase();
    if(proto === 'apimart' || base.includes('apimart.ai')) return 'apimart';
    if(proto === 'volcengine' || providerId === 'volcengine') return 'volcengine';
    return '';
}
function volcengineProvider(){ return window.SmartCanvasProviderSelection?.volcengineProvider?.(); }
function volcengineVideoModels(){ return window.SmartCanvasProviderSelection?.volcengineVideoModels?.(); }
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
async function waitSmartComfyTaskResult(taskId){ return window.SmartCanvasGeneration?.waitSmartComfyTaskResult?.(taskId); }
function workflowAssetCategories(){ return window.SmartCanvasAssetLibrary?.workflowAssetCategories?.(); }
async function zipDownloadImageItems(title, items){ return window.SmartCanvasMediaDownload?.zipDownloadImageItems?.(title, items); }
async function zipSaveImageItemsAs(title, items){ return window.SmartCanvasMediaDownload?.zipSaveImageItemsAs?.(title, items); }
function smartMediaPreviewUrl(itemOrUrl, size=512){ return window.SmartCanvasMediaLayout?.smartMediaPreviewUrl?.(itemOrUrl, size); }
function syncPromptNodeHeightForSplit(node, prevExtra=0){ return window.SmartCanvasPromptLayout?.syncPromptNodeHeightForSplit?.(node, prevExtra); }
