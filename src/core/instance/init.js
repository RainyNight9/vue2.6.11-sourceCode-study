/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0


// new Vue()会执行Vue类的构造函数，构造函数内部会执行_init方法，
// 所以new Vue()所干的事情其实就是_init方法所干的事情
export function initMixin (Vue: Class<Component>) {
  // 给Vue类的原型上绑定_init方法，同时_init方法的定义也在该函数内部
  // new Vue()所干的事情其实就是_init方法所干的事情
  Vue.prototype._init = function (options?: Object) {
    // 首先，把Vue实例赋值给变量vm，
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // 并且把用户传递的options选项与当前构造函数的options属性及其父级构造函数的options属性进行合并，
      // 得到一个新的options选项赋值给$options属性，
      // 并将$options属性挂载到Vue实例上
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // 可简单理解为返回 vm.constructor.options，相当于 Vue.options
        options || {},
        vm
      )
      // 那么问题来了，为什么要把相同的钩子函数转换成数组呢？这是因为Vue允许用户使用Vue.mixin方法
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    // 合适的时机调用了callHook函数来触发生命周期的钩子
    vm._self = vm
    initLifecycle(vm) // 初始化生命周期
    initEvents(vm)  // 初始化事件
    initRender(vm) // 初始化渲染
    callHook(vm, 'beforeCreate') // 调用生命周期钩子函数
    initInjections(vm) // resolve injections before data/props // 初始化 injections
    initState(vm) // 初始化props,methods,data,computed,watch
    initProvide(vm) // resolve provide after data/props  // 初始化 provide
    callHook(vm, 'created') // 调用生命周期钩子函数

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 调用$mount函数进入模板编译与挂载阶段
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
    // 如果没有传入el选项，则不进入下一个生命周期阶段，
    // 需要用户手动执行vm.$mount方法才进入下一个生命周期阶段
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
