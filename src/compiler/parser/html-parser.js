/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  //  <div><p><span></span></p></div>
  // 当解析到开始标签<div>时，就把div推入栈中，然后继续解析，
  // 当解析到<p>时，再把p推入栈中，同理，再把span推入栈中，
  // 当解析到结束标签</span>时，此时栈顶的标签刚好是span的开始标签，
  // 那么就用span的开始标签和结束标签构建AST节点，并且从栈中把span的开始标签弹出，
  // 那么此时栈中的栈顶标签p就是构建好的span的AST节点的父节点

  // <div><p><span></p></div>
  // 当解析到结束标签</p>时，此时栈顶的标签应该是p才对，
  // 而现在是span，那么就说明span标签没有被正确闭合，
  // 此时控制台就会抛出警告：‘tag has no matching end tag.’
  // 检测模板字符串中是否有未正确闭合的标签
  const stack = [] // 维护AST节点层级的栈

  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no // 用来检测一个标签是否是可以省略闭合标签的非自闭合标签
  let index = 0 // 解析游标，标识当前从何处开始解析模板字符串
  let last, // 存储剩余还未解析的模板字符串
      lastTag // 存储着位于 stack 栈顶的元素

  // 开启一个 while 循环，循环结束的条件是 html 为空，即 html 被 parse 完毕
  // 接着开启while 循环，循环的终止条件是 模板字符串html为空，即模板字符串被全部编译完毕。
  // 在每次while循环中， 先把 html的值赋给变量 last
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // 确保即将 parse 的内容不是在纯文本标签里 (script,style,textarea)
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      /**
       * 如果html字符串是以'<'开头,则有以下几种可能
       * 开始标签:<div>
       * 结束标签:</div>
       * 注释:<!-- 我是注释 -->
       * 条件注释:<!-- [if !IE] --> <!-- [endif] -->
       * DOCTYPE:<!DOCTYPE html>
       * 需要一一去匹配尝试
       */
      // '<' 在第一个位置，为其余5种类型
      if (textEnd === 0) {
        // Comment:
        // 解析是否是注释
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 解析是否是条件注释
        if (conditionalComment.test(html)) {
          // 若为条件注释，则继续查找是否存在']>'
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            // 若存在 ']>',则从原本的html字符串中把条件注释截掉，
            // 把剩下的内容重新赋给html，继续向后匹配
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        // 解析是否是DOCTYPE
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        // 解析结束标签
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        // handleStartTag函数用来对parseStartTag函数的解析结果进行进一步处理，
        // 它接收parseStartTag函数的返回值作为参数。
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      // '<' 不在第一个位置，文本开头
      // 如果html字符串不是以'<'开头,则解析文本类型
      if (textEnd >= 0) {
        // 如果html字符串不是以'<'开头,说明'<'前面的都是纯文本，无需处理
        // 那就把'<'以后的内容拿出来赋给rest
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          /**
           * 用'<'以后的内容rest去匹配endTag、startTagOpen、comment、conditionalComment
           * 如果都匹配不上，表示'<'是属于文本本身的内容
           */
          // 在'<'之后查找是否还有'<'
          next = rest.indexOf('<', 1)
          // 如果没有了，表示'<'后面也是文本
          if (next < 0) break
          // 如果还有，表示'<'是文本中的一个字符
          textEnd += next
          // 那就把next之后的内容截出来继续下一轮循环匹配
          rest = html.slice(textEnd)
        }
        // '<'是结束标签的开始 ,说明从开始到'<'都是文本，截取出来
        text = html.substring(0, textEnd)
      }
      // 整个模板字符串里没有找到`<`,说明整个模板字符串都是文本
      // 如果在html字符串中没有找到'<'，表示这一段html字符串都是纯文本
      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }
      // 把截取出来的text转化成textAST
      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      // 父元素为script、style、textarea时，其内部的内容全部当做纯文本处理
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 将整个字符串作为文本对待
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  // 调用parseEndTag函数并不传递任何参数
  // parseEndTag函数不传递任何参数是用于处理栈中剩余未处理的标签
  // 因为如果不传递任何函数，此时parseEndTag函数里的pos就为0，那么pos>=0就会恒成立，
  // 那么就会逐个警告缺少闭合标签，并调用 options.end将其闭合
  parseEndTag()

  // advance函数是用来移动解析游标的，解析完一部分就把游标向后移动一部分，确保不会重复解析
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  //parse 开始标签
  function parseStartTag () {
    // 开始标签匹配解析
    const start = html.match(startTagOpen)
    // '<div></div>'.match(startTagOpen)  => ['<div','div',index:0,input:'<div></div>']
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      /**
       * <div a=1 b=2 c=3></div>
       * 从<div之后到开始标签的结束符号'>'之前，一直匹配属性attrs
       * 所有属性匹配完之后，html字符串还剩下
       * 自闭合标签剩下：'/>'
       * 非自闭合标签剩下：'></div>'
       */
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      /**
       * 这里判断了该标签是否为自闭合标签
       * 自闭合标签如:<input type='text' />
       * 非自闭合标签如:<div></div>
       * '></div>'.match(startTagClose) => [">", "", index: 0, input: "></div>", groups: undefined]
       * '/><div></div>'.match(startTagClose) => ["/>", "/", index: 0, input: "/><div></div>", groups: undefined]
       * 因此，我们可以通过end[1]是否是"/"来判断该标签是否是自闭合标签
       */
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  // handleStartTag函数用来对parseStartTag函数的解析结果进行进一步处理，
  // 它接收parseStartTag函数的返回值作为参数。
  // 处理 parseStartTag 的结果
  function handleStartTag (match) {
    const tagName = match.tagName // 开始标签的标签名
    const unarySlash = match.unarySlash // 是否为自闭合标签的标志，自闭合为"",非自闭合为"/"

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash // 布尔值，标志是否为自闭合标签

    const l = match.attrs.length  // match.attrs 数组的长度
    const attrs = new Array(l) // 一个与match.attrs数组长度相等的数组

    // 循环处理提取出来的标签属性数组match.attrs
    for (let i = 0; i < l; i++) {
      // 首先定义了 args常量，它是解析出来的标签属性数组中的每一个属性对象，
      // 即match.attrs 数组中每个元素对象
      // const args = ["class="a"", "class", "=", "a", undefined, undefined, index: 0, input: "class="a" id="b"></div>", groups: undefined]
      const args = match.attrs[i]
      // 接着定义了value，用于存储标签属性的属性值，
      // 在代码中尝试取args的args[3]、args[4]、args[5]，
      // 如果都取不到，则给value复制为空
      const value = args[3] || args[4] || args[5] || ''
      // 接着定义了shouldDecodeNewlines，这个常量主要是做一些兼容性处理，
      // 如果 shouldDecodeNewlines 为 true，意味着 Vue 在编译模板的时候，要对属性值中的换行符或制表符做兼容处理。
      // 而shouldDecodeNewlinesForHref为true 意味着Vue在编译模板的时候，要对a标签的 href属性值中的换行符或制表符做兼容处理
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      // 最后将处理好的结果存入之前定义好的与match.attrs数组长度相等的attrs数组中
      attrs[i] = {
        name: args[1], // 标签属性的属性名，如class
        value: decodeAttr(value, shouldDecodeNewlines) // 标签属性的属性值，如class对应的a
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }
    // 最后，如果该标签是非自闭合标签，则将标签推入栈中
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }
    // 如果该标签是自闭合标签，现在就可以调用start钩子函数并传入处理好的参数来创建AST节点了
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // parse 结束标签
  // 结束标签名tagName、结束标签在html字符串中的起始和结束位置start和end
  // 第一种是三个参数都传递，用于处理普通的结束标签
  // 第二种是只传递tagName
  // 第三种是三个参数都不传递，用于处理栈中剩余未处理的标签
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      // 处理普通的结束标签
      // 从后往前遍历栈，在栈中寻找与tagName相同的标签并记录其所在的位置pos
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      // 处理栈中剩余未处理的标签
      // 将pos置为0
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      // 从栈顶位置从后向前遍历直到pos处，
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          // 如果发现stack栈中存在索引大于pos的元素，那么该元素一定是缺少闭合标签的
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {
          // 立即将其闭合，这是为了保证解析结果的正确性
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      // 最后把pos位置以后的元素都从stack栈中弹出
      stack.length = pos
      // 以及把lastTag更新为栈顶元素
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      // 补全p标签并创建AST节点
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
