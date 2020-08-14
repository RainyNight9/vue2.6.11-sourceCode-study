/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

// 首先定义了变量sharedPropertyDefinition，它是一个默认的属性描述符。
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  // 首先，给实例上新增了一个属性_watchers，用来存储当前实例中所有的watcher实例，
  // 无论是使用vm.$watch注册的watcher实例还是使用watch选项注册的watcher实例，
  // 都会被保存到该属性中
  vm._watchers = []
  // 在每个组件上新增了vm._watchers属性，用来存放这个组件内用到的所有状态的依赖，
  // 当其中一个状态发生变化时，就会通知到组件，
  // 然后由组件内部使用虚拟DOM进行数据比对，从而降低内存开销，提高性能


  const opts = vm.$options
  // 有顺序的调用：
  // 第一步
  if (opts.props) initProps(vm, opts.props)
  // 第二步
  if (opts.methods) initMethods(vm, opts.methods)
  // 第三步
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // 第四步
  if (opts.computed) initComputed(vm, opts.computed)
  // 第五步
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// 初始化 props
function initProps (vm: Component, propsOptions: Object) {
  // 父组件传入的真实props数据
  const propsData = vm.$options.propsData || {}
  // 指向vm._props的指针，所有设置到props变量中的属性都会保存到vm._props中
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 指向vm.$options._propKeys的指针，缓存props对象中的key，
  // 将来更新props时只需遍历vm.$options._propKeys数组即可得到所有props的key
  const keys = vm.$options._propKeys = []
  // 当前组件是否为根组件
  const isRoot = !vm.$parent
  // root instance props should be converted

  // 接着，判断当前组件是否为根组件，
  // 如果不是，那么不需要将props数组转换为响应式的
  if (!isRoot) {
    toggleObserving(false)
  }

  // 接着，遍历props选项拿到每一对键值
  for (const key in propsOptions) {
    // 先将键名添加到keys中
    keys.push(key)
    // 然后调用validateProp函数校验父组件传入的props数据类型是否匹配并获取到传入的值value
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    // 然后将键和值通过defineReactive函数添加到props（即vm._props）中
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 添加完之后再判断这个key在当前实例vm中是否存在，
    // 如果不存在，则调用proxy函数在vm上设置一个以key为属性的代码，
    // 当使用vm[key]访问数据时，其实访问的是vm._props[key]
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

// 初始化 data
function initData (vm: Component) {
  let data = vm.$options.data
  // 此处有没有 想起我们的 写法区别
  // 数据对象 和 函数
  // 我在想 既然最后都是要处理成 数据对象，为啥不直接写数据对象呢？
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}

  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    // 第一种 key与methods中某个属性名是否重复
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 第二种 key与prop中某个属性名是否重复
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 如果都没有重复，则调用proxy函数将data对象中key不以_或$开头的属性代理到实例vm上，
      // 就可以通过this.xxx来访问data选项中的xxx数据了
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 最后，调用observe函数将data中的数据转化成响应式
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化 computed
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  // 首先定义了一个变量watchers并将其赋值为空对象，
  // 同时将其作为指针指向vm._computedWatchers
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  // 接着，遍历computed选项中的每一项属性
  for (const key in computed) {
    // 首先获取到每一项的属性值，记作userDef
    const userDef = computed[key]
    // 然后判断userDef是不是一个函数，
    // 如果是函数，则该函数默认为取值器getter，将其赋值给变量getter；
    // 如果不是函数，则说明是一个对象，则取对象中的get属性作为取值器赋给变量getter
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 接着判断如果不是在服务端渲染环境下，
    // 则创建一个watcher实例，
    // 并将当前循环到的的属性名作为键，
    // 创建的watcher实例作为值存入watchers对象中
    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 最后，判断当前循环到的的属性名是否存在于当前实例vm上，
    // 如果存在，则在非生产环境下抛出警告；
    // 如果不存在，则调用defineComputed函数为实例vm上设置计算属性
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 定义计算属性
// 其作用是为target上定义一个属性key，
// 并且属性key的getter和setter根据userDef的值来设置
export function defineComputed (
  target: any, // 实例
  key: string,
  userDef: Object | Function
) {
  // 接着，在函数内部定义了变量shouldCache，用于标识计算属性是否应该有缓存。
  // 该变量的值是当前环境是否为非服务端渲染环境，如果是非服务端渲染环境则该变量为true。
  // 也就是说，只有在非服务端渲染环境下计算属性才应该有缓存
  const shouldCache = !isServerRendering()
  // 接着，判断如果userDef是一个函数，则该函数默认为取值器getter，
  // 此处在非服务端渲染环境下并没有直接使用userDef作为getter，
  // 而是调用createComputedGetter函数创建了一个getter，
  // 这是因为userDef只是一个普通的getter，它并没有缓存功能，
  // 所以我们需要额外创建一个具有缓存功能的getter，
  // 而在服务端渲染环境下可以直接使用userDef作为getter，
  // 因为在服务端渲染环境下计算属性不需要缓存。
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = 
    shouldCache ? createComputedGetter(key) : createGetterInvoker(userDef)
    // 由于用户没有设置setter函数，所以将sharedPropertyDefinition.set设置为noop
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = 
    userDef.get ? 
    shouldCache && userDef.cache !== false ? createComputedGetter(key) : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }

  // 接着，再判断在非生产环境下如果用户没有设置setter的话，
  // 那么就给setter一个默认函数，这是为了防止用户在没有设置setter的情况下修改计算属性，
  // 从而为其抛出警告
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 最后调用Object.defineProperty方法将属性key绑定到target上，
  // 其中的属性描述符就是上面设置的sharedPropertyDefinition。
  // 如此以来，就将计算属性绑定到实例vm上了
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 高阶函数
// 其实是将computedGetter函数赋给了sharedPropertyDefinition.get
function createComputedGetter (key) {

  return function computedGetter () {
    // 首先存储在当前实例上_computedWatchers属性中key所对应的watcher实例，
    const watcher = this._computedWatchers && this._computedWatchers[key]
    // 如果watcher存在，则调用watcher实例上的depend方法和evaluate方法，
    // 并且将evaluate方法的返回值作为计算属性的计算结果返回
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

// 初始化 方法
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    // 在非生产环境下判断
    if (process.env.NODE_ENV !== 'production') {
      // 第一种 不是 function
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 第二种 方法名字 重复
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 第三种 某个方法名如果在实例vm中已经存在 并且 方法名是以_或$开头的
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 最后，如果上述判断都没问题，那就method绑定到实例vm上，
    // 就可以通过this.xxx来访问methods选项中的xxx方法了
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 初始化 监听
function initWatch (vm: Component, watch: Object) {
  // 在函数内部会遍历watch选项，
  // 拿到每一项的key和对应的值handler。
  // 然后判断handler是否为数组，
  // 如果是数组则循环该数组并将数组中的每一项依次调用createWatcher函数来创建watcher；
  // 如果不是数组，则直接调用createWatcher函数来创建watcher
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 创建监听
function createWatcher (
  vm: Component, // 当前实例
  expOrFn: string | Function, // 被侦听的属性表达式
  handler: any, // watch选项中每一项的值
  options?: Object // 用于传递给vm.$watch的选项对象
) {
  // 首先会判断传入的handler是否为一个对象，
  // 如果是一个对象，那么就认为用户使用的是这种写法
  // watch: {
  //   c: {
  //       handler: function (val, oldVal) { /* ... */ },
	// 	     deep: true
  //   }
  // }
  if (isPlainObject(handler)) {
    // 将handler对象整体记作options，
    // 把handler对象中的handler属性作为真正的回调函数记作handler
    options = handler
    handler = handler.handler
  }

  // 接着判断传入的handler是否为一个字符串，
  // 如果是一个字符串，那么就认为用户使用的是这种写法
  // watch: {
  //   // methods选项中的方法名
  //   b: 'someMethod',
  // }
  if (typeof handler === 'string') {
    // 在初始化methods选项的时候会将选项中的每一个方法都绑定到当前实例上，
    // 所以此时我们只需从当前实例上取出该方法作为真正的回调函数记作handler
    handler = vm[handler]
  }
  // 如果既不是对象又不是字符串，那么我们就认为它是一个函数，就不做任何处理
  // 最后，调用vm.$watcher方法并传入以上三个参数完成初始化watch
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 三个操作数据的
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this


    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    // 用于区分用户创建的watcher实例和Vue内部创建的watcher实例
    options.user = true 
    const watcher = new Watcher(vm, expOrFn, cb, options)

    // immediate: true 将立即以表达式的当前值触发回调
    if (options.immediate) {
      // 接着判断如果用户在选项参数options中指定的immediate为true，
      // 则立即用被观察数据当前的值触发回调
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }

    //  返回一个取消观察函数，用来停止触发回调
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
