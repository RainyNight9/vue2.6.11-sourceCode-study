/* @flow */

import {
  warn,
  invokeWithErrorHandling
} from 'core/util/index'
import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

// normalizeEvent 就是根据事件名前面的不同标识反向解析出该事件所带的何种修饰符
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  // 就是判断事件名的第一个字符是何种标识进而判断出事件带有何种修饰符，
  // 最终将真实事件名及所带的修饰符返回
  return {
    name,
    once,
    capture,
    passive
  }
})

export function createFnInvoker (fns: Function | Array<Function>, vm: ?Component): Function {
  function invoker () {
    const fns = invoker.fns
    // 由于一个事件可能会对应多个回调函数，所以这里做了数组的判断
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      // 多个回调函数就依次调用
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
    }
  }
  invoker.fns = fns
  return invoker
}

// 该函数的作用是对比listeners和oldListeners的不同，
// 并调用参数中提供的add和remove进行相应的注册事件和卸载事件
export function updateListeners (
  on: Object, // 其中on对应listeners，
  oldOn: Object, // oldOn对应oldListeners
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, def, cur, old, event
  // 如果listeners对象中存在某个key（即事件名）而oldListeners中不存在，
  // 则说明这个事件是需要新增的
  for (name in on) {
    // 首先对on进行遍历， 获得每一个事件名，
    // 然后调用 normalizeEvent 函数处理， 
    // 处理完事件名后， 判断事件名对应的值是否存在，如果不存在则抛出警告，
    def = cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      // 如果存在，则继续判断该事件名在oldOn中是否存在，如果不存在，则调用add注册事件
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur, vm)
      }
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // 当我们第二次执行该函数的时候，判断如果 cur !== old，
      // 那么只需要更改 old.fns = cur 把之前绑定的 involer.fns 赋值为新的回调函数即可，
      // 并且 通过 on[name] = old 保留引用关系，
      // 这样就保证了事件回调只添加一次，之后仅仅去修改它的回调函数的引用
      old.fns = cur
      on[name] = old
    }
  }

  // 如果oldListeners对象中存在某个key（即事件名）而listeners中不存在，
  // 则说明这个事件是需要从事件系统中卸载的
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
