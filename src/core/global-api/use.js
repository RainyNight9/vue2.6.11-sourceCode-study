/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 首先定义了一个变量installedPlugins,该变量初始值是一个空数组，用来存储已安装过的插件。
    // 首先判断传入的插件是否存在于installedPlugins数组中（即已被安装过），
    // 如果存在的话，则直接返回，防止重复安装
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // 接下来获取到传入的其余参数，并且使用toArray方法将其转换成数组，
    // 同时将Vue插入到该数组的第一个位置，这是因为在后续调用install方法时，Vue必须作为第一个参数传入
    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)

    // 首先，判断传入的插件如果是一个提供了 install 方法的对象，
    // 那么就执行该对象中提供的 install 方法并传入参数完成插件安装
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 如果传入的插件是一个函数，那么就把这个函数当作install方法执行，同时传入参数完成插件安装
      plugin.apply(null, args)
    }
    // 插件安装完成之后，将该插件添加进已安装插件列表中，防止重复安装
    installedPlugins.push(plugin)
    return this
  }
}
