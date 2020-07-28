# v2.6.11 简易学习路线指南如下：

### 1.变化侦测篇

#### Object变化侦测篇

##### 学习Vue中如何实现数据的响应式系统，从而达到数据驱动视图。

    在Angular中是通过脏值检查流程来实现变化侦测；

    在React是通过对比虚拟DOM来实现变化侦测，

    在Vue中也有自己的一套变化侦测实现机制。

1.使Object数据变得“可观测” Observer类 // [源码位置：src/core/observer/index.js](src/core/observer/index.js)

2.依赖收集 （在getter中收集依赖，在setter中通知依赖更新）Dep类 // [源码位置：src/core/observer/dep.js](src/core/observer/dep.js)

3.依赖到底是谁 Watcher类 // [源码位置：src/core/observer/watcher.js](src/core/observer/watcher.js)

4.缺点 当我们向object数据里添加一对新的key/value或删除一对已有的key/value时，它是无法观测到的，导致当我们对object数据添加或删除值时，无法通知依赖，无法驱动视图进行响应式更新。当然，Vue也注意到了这一点，为了解决这一问题，Vue增加了两个全局API:Vue.set和Vue.delete

##### 其整个流程大致如下：

    1.Data通过observer转换成了getter/setter的形式来追踪变化。
    2.当外界通过Watcher读取数据时，会触发getter从而将Watcher添加到依赖中。
    3.当数据发生了变化时，会触发setter，从而向Dep中的依赖（即Watcher）发送通知。
    4.Watcher接收到通知后，会向外界发送通知，变化通知到外界后可能会触发视图更新，也有可能触发用户的某个回调函数等

#### Array变化侦测篇

1. 使Array型数据可观测（重新定义数组方法）数组方法拦截器 // [源码位置：src/core/observer/array.js](src/core/observer/array.js) 使用拦截器 // [源码位置：src/core/observer/index.js](src/core/observer/index.js)

2. 依赖收集，通知依赖// [源码位置：src/core/observer/index.js](src/core/observer/index.js) [源码位置2: src/core/observer/array.js](src/core/observer/array.js)

3. 缺点：而使用下述例子中的操作方式来修改数组是无法侦测到的. Vue增加了两个全局API:Vue.set和Vue.delete

    ```
    let arr = [1,2,3]
    arr[0] = 5;       // 通过数组下标修改数组中的数据
    arr.length = 0    // 通过修改数组长度清空数组
    ```

##### 其整体流程如下：

    1.对于Array型数据也在getter中进行依赖收集
    2.创建了数组方法拦截器，从而成功的将数组数据变的可观测

### 2.虚拟 DOM 篇

#### 是什么？

    所谓虚拟DOM，就是用一个JS对象来描述一个DOM节点,如下事例：

```
<div class="a" id="b">文本内容</div>

{
    tag:'div',        // 元素标签
    attrs:{           // 属性
        class:'a',
        id:'b'
    },
    text:'文本内容',  // 文本内容
    children:[]       // 子元素
}
```

#### 为什么？

    1.Vue是数据驱动视图的，数据发生变化视图就要随之更新，在更新视图的时候难免要操作DOM,而操作真实DOM又是非常耗费性能的，这是因为浏览器的标准就把 DOM 设计的非常复杂，所以一个真正的 DOM 元素是非常庞大的

    2.用JS的计算性能来换取操作DOM所消耗的性能。（因为无法避免，那就只能尽量少的去操作DOM，对比变化，计算出更新，在操作需要更新的DOM）

#### 虚拟DOM

1.VNode类 // [源码位置：src/core/vdom/vnode.js](src/core/vdom/vnode.js)

2.VNode的类型 // [源码位置：src/core/vdom/vnode.js](src/core/vdom/vnode.js)

>注释节点 

>文本节点

>克隆节点

>元素节点 // [http]由于元素节点所包含的情况相比而言比较复杂，源码中没有像前三种节点一样直接写死

组件节点
函数式组件节点

### 3.模板编译篇

    学习Vue内部是怎么把template模板编译成虚拟DOM,从而渲染出真实DOM

### 4.实例方法篇

    学习Vue中所有实例方法(即所有以$开头的方法)的实现原理

### 5.全局 API 篇

    习Vue中所有全局API的实现原理

### 6.生命周期篇

    学习Vue中组件的生命周期实现原理

### 7.指令篇

    学习Vue中所有指令的实现原理

### 8.过滤器篇

    学习Vue中所有过滤器的实现原理

### 9.内置组件篇

    学习Vue中内置组件的实现原理