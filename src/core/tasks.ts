import { HookType } from '@/types/enum'
import { EquipmentInfoHandler } from "@/utils/equipment";
import { HookTask, recordAndSend } from "./core";

const hookTaskMap: Record<string, Omit<HookTask, 'name'>> = {

  'static iframe': {
    onlyOnceEnable: true,
    condition: (fh) => fh.conf?.hookBlankIframe,
    onEnable: (fh) => {
      const hook = () => {
        const iframes = fh.win.document.querySelectorAll('iframe')
        for (const iframe of iframes) {
          fh.hookIframe(iframe)
          // if (!iframe.src || iframe.src === 'about:blank') { fh.hookIframe(iframe) }
        }
      }
      fh.win.addEventListener('DOMContentLoaded', () => {
        hook()
        fh.win.removeEventListener('DOMContentLoaded', hook)
      })
      hook()
    },
  },

  'script iframe': {
    condition: (fh) => fh.conf?.hookBlankIframe,
    onEnable: (fh) => {
      if(!fh.rawObjects.appendChild || !fh.rawObjects.insertBefore || !fh.rawObjects.replaceChild){
        const apply = (target: any, thisArg: Object, args: any) => {
          const res = target.apply(thisArg, args)
          const node = args[0]
          if (node?.tagName === 'IFRAME') {
            fh.hookIframe(node as HTMLIFrameElement)
          }
          return res
        }
  
        if (!fh.rawObjects.appendChild) {
          fh.rawObjects.appendChild = fh.win.HTMLElement.prototype.appendChild
          fh.win.HTMLElement.prototype.appendChild = new Proxy(fh.rawObjects.appendChild, { apply })
        }
        if (!fh.rawObjects.insertBefore) {
          fh.rawObjects.insertBefore = fh.win.HTMLElement.prototype.insertBefore
          fh.win.HTMLElement.prototype.insertBefore = new Proxy(fh.rawObjects.insertBefore, { apply })
        }
        if (!fh.rawObjects.replaceChild) {
          fh.rawObjects.replaceChild = fh.win.HTMLElement.prototype.replaceChild
          fh.win.HTMLElement.prototype.replaceChild = new Proxy(fh.rawObjects.replaceChild, { apply })
        }
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.appendChild) {
        fh.win.HTMLElement.prototype.appendChild = fh.rawObjects.appendChild
        fh.rawObjects.appendChild = undefined
      }
      if (fh.rawObjects.insertBefore) {
        fh.win.HTMLElement.prototype.insertBefore = fh.rawObjects.insertBefore
        fh.rawObjects.insertBefore = undefined
      }
      if (fh.rawObjects.replaceChild) {
        fh.win.HTMLElement.prototype.replaceChild = fh.rawObjects.replaceChild
        fh.rawObjects.replaceChild = undefined
      }
    },
  },

  'hook getOwnPropertyDescriptor': {
    onEnable: (fh) => {
      if (!fh.rawObjects.getOwnPropertyDescriptor) {
        fh.rawObjects.getOwnPropertyDescriptor = fh.win.Object.getOwnPropertyDescriptor

        const navigatorDesc = fh.rawObjects.navigatorDescriptor ?? fh.win.Object.getOwnPropertyDescriptor(fh.win, 'navigator')
        const screenDesc = fh.rawObjects.screenDescriptor ?? fh.win.Object.getOwnPropertyDescriptor(fh.win, 'screen')

        fh.win.Object.getOwnPropertyDescriptor = new Proxy(fh.rawObjects.getOwnPropertyDescriptor, {
          apply: (target, thisArg: Object, args: Parameters<typeof Object.getOwnPropertyDescriptor>) => {
            const [obj, prop] = args
            if (obj === fh.win) {
              if (prop === 'navigator') return navigatorDesc
              if (prop === 'screen') return screenDesc
            }
            return target.apply(thisArg, args)
          }
        })
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.getOwnPropertyDescriptor) {
        fh.win.Object.getOwnPropertyDescriptor = fh.rawObjects.getOwnPropertyDescriptor
        fh.rawObjects.getOwnPropertyDescriptor = undefined
      }
    }
  },

  'hook navigator': {
    condition: (fh) => !fh.isAllDefault(fh.conf?.fingerprint?.navigator),
    onEnable: (fh) => {
      if (!fh.rawObjects.navigatorDescriptor) {
        fh.rawObjects.navigatorDescriptor = fh.win.Object.getOwnPropertyDescriptor(fh.win, "navigator");
        fh.win.Object.defineProperty(fh.win, 'navigator', {
          value: new Proxy(fh.win.navigator, {
            get: (target, key: string) => {
              if (key in target) {
                let value: any | null
                if (key === 'userAgent' || key === 'appVersion' || key === 'userAgentData') {
                  /// Equipment
                  const seed = fh.getSeedByHookValue(fh.conf?.fingerprint?.navigator?.equipment)
                  if (seed !== null) {
                    if (!fh.equipmentHandler) {
                      fh.equipmentHandler = new EquipmentInfoHandler(target, seed, true)
                    }
                    value = fh.equipmentHandler.getValue(key)
                    if (value !== null) {
                      // 记录
                      recordAndSend(key as HookFingerprintKey)
                    }
                  } else {
                    value = null
                  }
                } else {
                  /// Other
                  value = fh.getValue('navigator', key)
                }
                if (value !== null) {
                  return value
                }
                const res = target[key as keyof Navigator]
                if (typeof res === "function") {
                  return res.bind(target)
                } else {
                  return res
                }
              } else {
                return undefined
              }
            }
          })
        });
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.navigatorDescriptor) {
        fh.win.Object.defineProperty(fh.win, "navigator", fh.rawObjects.navigatorDescriptor)
        fh.rawObjects.navigatorDescriptor = undefined
      }
    }
  },

  'hook screen': {
    condition: (fh) => !fh.isAllDefault(fh.conf?.fingerprint?.screen),
    onEnable: (fh) => {
      if (!fh.rawObjects.screenDescriptor) {
        fh.rawObjects.screenDescriptor = fh.win.Object.getOwnPropertyDescriptor(fh.win, "screen");
        fh.win.Object.defineProperty(fh.win, 'screen', {
          value: new Proxy(fh.win.screen, {
            get: (target, key: string) => {
              if (key in target) {
                const value = fh.getValue('screen', key)
                if (value !== null) {
                  return value
                }
                const res = target[key as keyof Screen]
                // @ts-ignore
                if (typeof res === "function") return res.bind(target)
                else return res
              } else {
                return undefined
              }
            }
          })
        })
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.screenDescriptor) {
        fh.win.Object.defineProperty(fh.win, "screen", fh.rawObjects.screenDescriptor)
        fh.rawObjects.screenDescriptor = undefined
      }
    }
  },

  'hook canvas': {
    condition: (fh) => fh.conf?.fingerprint?.other?.canvas?.type !== HookType.default,
    onEnable: (fh) => {
      if (!fh.rawObjects.toDataURL) {
        fh.rawObjects.toDataURL = fh.win.HTMLCanvasElement.prototype.toDataURL
        fh.win.HTMLCanvasElement.prototype.toDataURL = new Proxy(fh.rawObjects.toDataURL, {
          apply: (target, thisArg, args: Parameters<typeof HTMLCanvasElement.prototype.toDataURL>) => {
            const value = fh.getValue('other', 'canvas')
            if (value !== null) {
              let ctx = thisArg.getContext('2d');
              if (ctx !== null) {
                let style = ctx.fillStyle;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
                ctx.fillText(value, 0, 2)
                ctx.fillStyle = style;
              }
            }
            return target.apply(thisArg, args);
          }
        })
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.toDataURL) {
        fh.win.HTMLCanvasElement.prototype.toDataURL = fh.rawObjects.toDataURL
        fh.rawObjects.toDataURL = undefined
      }
    }
  },

  'hook audio': {
    condition: (fh) => fh.conf?.fingerprint?.other?.audio?.type !== HookType.default,
    onEnable: (fh) => {
      if (!fh.rawObjects.createDynamicsCompressor) {
        fh.rawObjects.createDynamicsCompressor = fh.win.OfflineAudioContext.prototype.createDynamicsCompressor
        fh.win.OfflineAudioContext.prototype.createDynamicsCompressor = new Proxy(fh.rawObjects.createDynamicsCompressor, {
          apply: (target, thisArg: OfflineAudioContext, args: Parameters<typeof OfflineAudioContext.prototype.createDynamicsCompressor>) => {
            const value = fh.getValue('other', 'audio')
            if (value === null) return target.apply(thisArg, args)
            const compressor = target.apply(thisArg, args)
            // 创建一个增益节点，添加噪音
            const gain = thisArg.createGain()
            // 根据需要设置噪音的强度
            gain.gain.value = (value as number) ?? Math.random() * 0.01
            compressor.connect(gain)
            // 将增益节点的输出连接到上下文的目标
            gain.connect(thisArg.destination)
            return compressor
          }
        })
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.createDynamicsCompressor) {
        fh.win.OfflineAudioContext.prototype.createDynamicsCompressor = fh.rawObjects.createDynamicsCompressor
        fh.rawObjects.createDynamicsCompressor = undefined
      }
    }
  },

  'hook webgl': {
    condition: (fh) => fh.conf?.fingerprint?.other?.webgl?.type !== HookType.default,
    onEnable: (fh) => {
      // ------------
      // getParameter
      // ------------
      if (!fh.rawObjects.wglGetParameter || !fh.rawObjects.wgl2GetParameter) {
        const UNMASKED_VENDOR_WEBGL = 0x9245;
        const UNMASKED_RENDERER_WEBGL = 0x9246;
        const getParameterApply = (
          target: typeof WebGLRenderingContext.prototype.getParameter | typeof WebGL2RenderingContext.prototype.getParameter,
          thisArg: WebGLRenderingContext | WebGL2RenderingContext,
          args: Parameters<typeof WebGLRenderingContext.prototype.getParameter> | Parameters<typeof WebGL2RenderingContext.prototype.getParameter>
        ) => {
          switch (args[0]) {
            case UNMASKED_RENDERER_WEBGL: {
              const value = fh.getValue('other', 'webgl', 'info')
              if (value === null) break;
              return value
            }
            case UNMASKED_VENDOR_WEBGL: {
              return 'Google Inc.'
            }
          }
          return target.apply(thisArg, args)
        }

        if (!fh.rawObjects.wglGetParameter) {
          fh.rawObjects.wglGetParameter = fh.win.WebGLRenderingContext.prototype.getParameter
          fh.win.WebGLRenderingContext.prototype.getParameter = new Proxy(fh.rawObjects.wglGetParameter, { apply: getParameterApply })
        }
        if (!fh.rawObjects.wgl2GetParameter) {
          fh.rawObjects.wgl2GetParameter = fh.win.WebGL2RenderingContext.prototype.getParameter
          fh.win.WebGL2RenderingContext.prototype.getParameter = new Proxy(fh.rawObjects.wgl2GetParameter, { apply: getParameterApply })
        }
      }

      // ------------
      // shaderSource
      // ------------
      if (!fh.rawObjects.wglShaderSource || !fh.rawObjects.wgl2ShaderSource) {
        const mainFuncRegx = /void\s+main\s*\(\s*(void)?\s*\)\s*\{[^}]*\}/
        const shaderSourceApply = (
          target: typeof WebGLRenderingContext.prototype.shaderSource | typeof WebGL2RenderingContext.prototype.shaderSource,
          thisArg: WebGLRenderingContext | WebGL2RenderingContext,
          args: Parameters<typeof WebGLRenderingContext.prototype.shaderSource> | Parameters<typeof WebGL2RenderingContext.prototype.shaderSource>
        ) => {
          if (args[1]) {
            if (args[1].includes('gl_FragColor')) {
              const color = fh.getValue('other', 'webgl', 'color')
              if (color) {
                args[1] = args[1].replace(mainFuncRegx, `void main(){gl_FragColor=${color};}`)
              }
            } else if (args[1].includes('gl_Position')) {
              const color = fh.getValue('other', 'webgl', 'color')
              if (color) {
                args[1] = args[1].replace(mainFuncRegx, `void main(){gl_Position=${color};}`)
              }
            }
          }
          return target.apply(thisArg, args)
        }

        if (!fh.rawObjects.wglShaderSource) {
          fh.rawObjects.wglShaderSource = fh.win.WebGLRenderingContext.prototype.shaderSource
          fh.win.WebGLRenderingContext.prototype.shaderSource = new Proxy(fh.rawObjects.wglShaderSource, { apply: shaderSourceApply })
        }
        if (!fh.rawObjects.wgl2ShaderSource) {
          fh.rawObjects.wgl2ShaderSource = fh.win.WebGL2RenderingContext.prototype.shaderSource
          fh.win.WebGL2RenderingContext.prototype.shaderSource = new Proxy(fh.rawObjects.wgl2ShaderSource, { apply: shaderSourceApply })
        }
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.wglGetParameter) {
        fh.win.WebGLRenderingContext.prototype.getParameter = fh.rawObjects.wglGetParameter
        fh.rawObjects.wglGetParameter = undefined
      }
      if (fh.rawObjects.wgl2GetParameter) {
        fh.win.WebGL2RenderingContext.prototype.getParameter = fh.rawObjects.wgl2GetParameter
        fh.rawObjects.wgl2GetParameter = undefined
      }
      if (fh.rawObjects.wglShaderSource) {
        fh.win.WebGLRenderingContext.prototype.shaderSource = fh.rawObjects.wglShaderSource
        fh.rawObjects.wglShaderSource = undefined
      }
      if (fh.rawObjects.wgl2ShaderSource) {
        fh.win.WebGL2RenderingContext.prototype.shaderSource = fh.rawObjects.wgl2ShaderSource
        fh.rawObjects.wgl2ShaderSource = undefined
      }
    }
  },

  'hook timezone': {
    condition: (fh) => fh.conf?.fingerprint?.other?.timezone?.type !== HookType.default,
    onEnable: (fh) => {
      if (!fh.rawObjects.DateTimeFormat) {
        fh.rawObjects.DateTimeFormat = fh.win.Intl.DateTimeFormat
        fh.win.Intl.DateTimeFormat = new Proxy(fh.rawObjects.DateTimeFormat, {
          construct: (target, args: Parameters<typeof Intl.DateTimeFormat>, newTarget) => {
            const currTimeZone = fh.getValue('other', 'timezone') as TimeZoneInfo
            args[0] = args[0] ?? currTimeZone.locale
            args[1] = Object.assign({ timeZone: currTimeZone.zone }, args[1]);
            return new target(...args)
          },
          apply: (target, thisArg: Intl.DateTimeFormat, args: Parameters<typeof Intl.DateTimeFormat>) => {
            const currTimeZone = fh.getValue('other', 'timezone') as TimeZoneInfo
            args[0] = args[0] ?? currTimeZone.locale
            args[1] = Object.assign({ timeZone: currTimeZone.zone }, args[1]);
            return target.apply(thisArg, args)
          },
        })
      }
      if (!fh.rawObjects.getTimezoneOffset) {
        fh.rawObjects.getTimezoneOffset = fh.win.Date.prototype.getTimezoneOffset
        fh.win.Date.prototype.getTimezoneOffset = new Proxy(fh.rawObjects.getTimezoneOffset, {
          apply: (target, thisArg: Date, args: Parameters<typeof Date.prototype.getTimezoneOffset>) => {
            const currTimeZone = fh.getValue('other', 'timezone') as TimeZoneInfo
            // return target.apply(thisArg, args)
            return currTimeZone.offset * -60
          }
        })
      }
    },
    onDisable: (fh) => {
      if (fh.rawObjects.DateTimeFormat) {
        fh.win.Intl.DateTimeFormat = fh.rawObjects.DateTimeFormat
        fh.rawObjects.DateTimeFormat = undefined
      }
      if (fh.rawObjects.getTimezoneOffset) {
        fh.win.Date.prototype.getTimezoneOffset = fh.rawObjects.getTimezoneOffset
        fh.rawObjects.getTimezoneOffset = undefined
      }
    }
  },

  'hook webrtc': {
    condition: (fh) => fh.conf?.fingerprint?.other?.webrtc?.type !== HookType.default,
  }

}

export const hookTasks = Object.entries(hookTaskMap).map(([name, task]): HookTask => ({...task, name}))
export default hookTasks