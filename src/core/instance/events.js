/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  // 在vm上新增_events属性并将其赋值为空对象，用来存储事件
  // 这个_events属性就是用来作为当前实例的事件中心，
  // 所有绑定在这个实例上的事件都会存储在事件中心_events属性中
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  // 获取父组件注册的事件赋给listeners，
  const listeners = vm.$options._parentListeners
  // 如果listeners不为空，
  // 则调用updateComponentListeners函数，将父组件向子组件注册的事件注册到子组件的实例中
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  // 调用了updateListeners函数，并把listeners以及add和remove这两个函数传入
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/

  // 第一个参数是订阅的事件名，可以是数组，表示订阅多个事件。
  // 第二个参数是回调函数，当触发所订阅的事件时会执行该回调函数
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this

    // 首先，判断传入的事件名是否是一个数组，
    // 如果是数组，就表示需要一次性订阅多个事件，就遍历该数组，
    // 将数组中的每一个事件都递归调用$on方法将其作为单个事件订阅
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      // 如果不是数组，那就当做单个事件名来处理，
      // 以该事件名作为key，先尝试在当前实例的_events属性中获取其对应的事件列表，
      // 如果获取不到就给其赋空数组为默认值，并将第二个参数回调函数添加进去
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this

    // 给on上绑定一个fn属性，
    // 属性值为用户传入的回调fn，
    // 这样在使用$off移除事件的时候，$off内部会判断如果回调函数列表中某一项的fn属性与fn相同时，就可以成功移除事件了
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    // 先通过$on方法订阅事件，同时所使用的回调函数并不是原本的fn而是子函数on
    vm.$on(event, on)
    return vm
  }

  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 首先，判断如果没有传入任何参数（即arguments.length为0），
    // 这就是第一种情况：如果没有提供参数，则移除所有的事件监听器。
    // 当前实例上的所有事件都存储在事件中心_events属性中，
    // 要想移除所有的事件，那么只需把_events属性重新置为空对象即可
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }

    // array of events
    // 接着，判断如果传入的需要移除的事件名是一个数组，就表示需要一次性移除多个事件，
    // 那么我们只需同订阅多个事件一样，遍历该数组，
    // 然后将数组中的每一个事件都递归调用$off方法进行移除即可
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }

    // specific event
    // 接着，获取到需要移除的事件名在事件中心中对应的回调函数cbs
    const cbs = vm._events[event]

    // 接着，判断如果cbs不存在，那表明在事件中心从来没有订阅过该事件，
    // 那就谈不上移除该事件，直接返回，退出程序即可
    if (!cbs) {
      return vm
    }

    // 接着，如果cbs存在，但是没有传入回调函数fn，
    // 这就是第二种情况：如果只提供了事件，则移除该事件所有的监听器。
    // 在事件中心里面，一个事件名对应的回调函数是一个数组，
    // 要想移除所有的回调函数我们只需把它对应的数组设置为null即可
    if (!fn) {
      vm._events[event] = null
      return vm
    }

    // specific handler
    // 接着，如果既传入了事件名，又传入了回调函数，cbs也存在，
    // 那这就是第三种情况：如果同时提供了事件与回调，则只移除这个回调的监听器。
    // 那么我们只需遍历所有回调函数数组cbs，
    // 如果cbs中某一项与fn相同，或者某一项的fn属性与fn相同，那么就将其从数组中删除即可
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }

    // 根据传入的事件名从当前实例的_events属性（即事件中心）中获取到该事件名所对应的回调函数cbs
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 然后再获取传入的附加参数args
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      // 由于cbs是一个数组，所以遍历该数组，拿到每一个回调函数，执行回调函数并将附加参数args传给该回调
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
