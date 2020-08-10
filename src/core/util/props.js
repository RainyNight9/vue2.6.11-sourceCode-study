/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

export function validateProp (
  key: string, // 遍历propOptions时拿到的每个属性名
  propOptions: Object, // 当前实例规范化后的props选项
  propsData: Object, // 父组件传入的真实props数据
  vm?: Component // 当前实例
): any {

  // 当前key在propOptions中对应的值
  const prop = propOptions[key]
  // 当前key是否在propsData中存在，即父组件是否传入了该属性
  const absent = !hasOwn(propsData, key)
  // 当前key在propsData中对应的值，即父组件对于该属性传入的真实值
  let value = propsData[key]
  // boolean casting
  // 接着，判断prop的type属性是否是布尔类型（Boolean）
  // getTypeIndex函数用于判断prop的type属性中是否存在某种类型
  // 如果存在，则返回该类型在type属性中的索引（因为type属性可以是数组），
  // 如果不存在则返回-1
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {
    // 如果absent为true(即父组件没有传入该prop属性) 并且 该属性也没有默认值的时候，
    // 将该属性值设置为false
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // 该属性值为空字符串或者属性值与属性名相等
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      // prop的type属性中不存在String类型
      // 如果prop的type属性中存在String类型，
      // 那么Boolean类型在type属性中的索引必须小于String类型的索引（即Boolean类型的优先级更高）
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // check default value
  // 如果不是布尔类型，是其它类型的话，那就只需判断父组件是否传入该属性即可
  // 如果没有传入，则该属性值为undefined
  if (value === undefined) {
    // 此时调用getPropDefaultValue函数，获取该属性的默认值，并将其转换成响应式
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)
    toggleObserving(prevShouldObserve)
  }

  // 如果父组件传入了该属性并且也有对应的真实值，
  // 那么在非生产环境下会调用assertProp函数
  // 校验该属性值是否与要求的类型相匹配
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  // 最后将父组件传入的该属性的真实值返回
  return value
}

/**
 * Get the default value of a prop.
 */
// 其作用是根据子组件props选项中的key获取其对应的默认值
function getPropDefaultValue (
  vm: ?Component, // 当前实例
  prop: PropOptions, // 子组件props选项中的每个key对应的值
  key: string // 子组件props选项中的每个key
  ): any {
  // no default, return undefined
  // 首先判断prop中是否有default属性，
  // 如果没有，则表示没有默认值，直接返回
  if (!hasOwn(prop, 'default')) {
    return undefined
  }

  // 如果有则取出default属性，赋给变量def
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  // 接着判断在非生产环境下def是否是一个对象，
  // 如果是，则抛出警告：对象或数组默认值必须从一个工厂函数获取
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  // 接着，再判断如果父组件没有传入该props属性，
  // 但是在vm._props中有该属性值，这说明vm._props中的该属性值就是默认值
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  // 最后，判断def是否为函数  并且  prop.type不为Function，
  // 如果是的话表明def是一个返回对象或数组的工厂函数，那么将函数的返回值作为默认值返回；
  // 如果def不是函数，那么则将def作为默认值返回
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
// 其作用是校验父组件传来的真实值是否与prop的type类型相匹配
// 如果不匹配则在非生产环境下抛出警告
function assertProp (
  prop: PropOptions, // prop选项
  name: string, // props中prop选项的key
  value: any, // 父组件传入的propsData中key对应的真实数据
  vm: ?Component, // 当前实例
  absent: boolean // 当前key是否在propsData中存在，即父组件是否传入了该属性
) {
  // 函数内部首先判断prop中如果设置了必填项（即prop.required为true）
  // 并且父组件又没有传入该属性，此时则抛出警告：提示该项必填
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  // 接着判断如果该项不是必填的并且该项的值value不存在
  // 那么此时是合法的，直接返回
  if (value == null && !prop.required) {
    return
  }

  // prop中的type类型
  let type = prop.type
  // 校验是否成功
  let valid = !type || type === true
  // 保存期望类型的数组，当校验失败抛出警告时，会提示用户该属性所期望的类型是什么
  const expectedTypes = []

  // 接下来开始校验类型，如果用户设置了type属性
  if (type) {
    // 则判断该属性是不是数组，如果不是，则统一转化为数组，方便后续处理
    if (!Array.isArray(type)) {
      type = [type]
    }
    // 接下来遍历type数组，并调用assertType函数校验value。
    // assertType函数校验后会返回一个对象，如：
    // {
    //     vaild:true,       // 表示是否校验成功
    //     expectedType：'Boolean'   // 表示被校验的类型
    // }
    // 这里请注意：上面循环中的条件语句有这样一个条件：!vaild，
    // 即type数组中还要有一个校验成功，循环立即结束，表示校验通过
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  // 接下来，如果循环完毕后vaild为false，即表示校验未通过，则抛出警告
  if (!valid) {
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  // 一个牛逼的 自定义校验函数的支持，比如：
  // props:{
  //   // 自定义验证函数
  //    propF: {
  //      validator: function (value) {
  //        // 这个值必须匹配下列字符串中的一个
  //        return ['success', 'warning', 'danger'].indexOf(value) !== -1
  //      }
  //    }
  // }
  // 首先获取到用户传入的校验函数，调用该函数并将待校验的数据传入，如果校验失败，则抛出警告
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isSameType (a, b) {
  return getType(a) === getType(b)
}

function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (expectedTypes.length === 1 &&
      isExplicable(expectedType) &&
      !isBoolean(expectedType, receivedType)) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

function isExplicable (value) {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
