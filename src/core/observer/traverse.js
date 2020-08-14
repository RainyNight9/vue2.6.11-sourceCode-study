/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

// Set对象是值的集合，你可以按照插入的顺序迭代它的元素。 
// Set中的元素只会出现一次，即 Set 中的元素是唯一的。
const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

// 该函数其实就是个递归遍历的过程，把被观察数据的内部值都递归遍历读取一遍
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  // 首先先判断传入的val类型，如果它不是Array或object，再或者已经被冻结，那么直接返回，退出程序
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }

  // 然后拿到val的dep.id，存入创建好的集合seen中，
  // 因为集合相比数据而言它有天然的去重效果，以此来保证存入的dep.id没有重复，不会造成重复收集依赖
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }

  // 接下来判断如果是数组，则循环数组，将数组中每一项递归调用_traverse；
  // 如果是对象，则取出对象所有的key，然后执行读取操作，再递归内部值
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }

  // 这样，把被观察数据内部所有的值都递归的读取一遍后，
  // 那么这个watcher实例就会被加入到对象内所有值的依赖列表中，
  // 之后当对象内任意某个值发生变化时就能够得到通知了
}
