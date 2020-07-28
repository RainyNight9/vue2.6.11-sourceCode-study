/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
  shouldObserve = value
}

/**
 * 附加到每个观察对象的观察者类。
 * 附加后，观察者将目标对象的属性键转换为getter/setter，后者收集依赖项并分派更新。
 * Observer类会通过递归的方式把一个对象的所有属性都转化成可观测对象
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor(value: any) {
    this.value = value
    this.dep = new Dep() // 实例化一个依赖管理器，用来收集数组依赖
    this.vmCount = 0
    // 给value新增一个__ob__属性，值为该value的Observer实例
    // 相当于为value打上标记，表示它已经被转化成响应式了，避免重复操作
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      // 当value为数组时的逻辑

      // hasProto 能力检测：判断__proto__是否可用，因为有的浏览器不支持该属性
      if (hasProto) {
        // value.__proto__ = arrayMethods
        protoAugment(value, arrayMethods)
      } else {
        // 拦截器中重写的7个方法循环加入到value上
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 将数组中的所有元素都转化为可被侦测的响应式
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * 遍历所有属性并将它们转换为getter/setter。
   * 仅当值类型为“对象”时才应调用此方法。
   */
  walk(obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * 观察数组项列表每一个子项
   * 遍历数组中的每一个元素，
   * 然后通过调用observe函数将每一个元素都转化成可侦测的响应式数据
   */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      // 通过observe函数为被获取的数据arr尝试创建一个Observer实例
      observe(items[i])
    }
  }
}

// helpers

/**
 * 通过拦截来增强目标对象或数组
 * 使用__proto__的原型链 
 */
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * 隐藏属性。
 * value, arrayMethods, arrayKeys 三个参数
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    // Object.defineProperty
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 尝试为value创建一个0bserver实例，如果创建成功，直接返回新创建的Observer实例。
 * 如果 Value 已经存在一个Observer实例，则直接返回它
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 数据有__ob__属性，表示它已经被转化成响应式的了
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 调用new Observer(value)将其转化成响应式的
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * 定义对象的反应属性。
 * 使一个对象转化成可观测对象
 * @param { Object } obj 对象
 * @param { String } key 对象的key
 * @param { Any } val 对象的某个key的值
 */
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 实例化一个依赖管理器，生成一个依赖管理数组dep
  const dep = new Dep()

  // 如果指定的属性存在于对象上，则返回其属性描述符对象（property descriptor），否则返回 undefined。
  // property {
  //   configurable: true, // 当且仅当指定对象的属性描述可以被改变或者属性可被删除时，为true。
  //   enumerable: true, // 当且仅当指定对象的属性可以被枚举出时，为 true。
  //   get: /*the getter function*/, // 该属性的访问器函数（getter）。如果没有访问器，该值为undefined
  //   set: undefined, // 该属性的设置器函数（setter）。如果没有设置器，该值为undefined。
  //   writable: true, // 当且仅当属性的值可以被改变时为true
  //   value: '', // 该属性的值
  // }
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 不可以被改变且属性不可被删除时 return
  if (property && property.configurable === false) {
    return
  }
  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  // 如果只传了obj和key，那么val = obj[key]
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 获取数据对应的Observer实例childOb, 递归观测子属性
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) { // Dep.target 就是watcher实例
        dep.depend() // 在getter中收集依赖
        if (childOb) {
          // Observer实例上依赖管理器，从而将依赖收集起来
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal) // 对新值进行观测
      dep.notify() // 在setter中通知依赖更新
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
