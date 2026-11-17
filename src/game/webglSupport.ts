import * as THREE from 'three';

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function scheduleAfterSoftwareDraw(
  renderer: THREE.WebGLRenderer,
  registerTimer: (id: number) => void,
  cb: () => void
) {
  try {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      registerTimer(window.setTimeout(cb, 80));
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        registerTimer(window.setTimeout(poll, 5));
      } else {
        if (sync) gl.deleteSync(sync);
        registerTimer(window.setTimeout(cb, 80));
      }
    };
    registerTimer(window.setTimeout(poll, 5));
  } catch {
    registerTimer(window.setTimeout(cb, 80));
  }
}
