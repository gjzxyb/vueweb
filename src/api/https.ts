import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type RawAxiosRequestConfig
} from 'axios'
import qs from 'qs'
import { ElMessage, ElLoading } from 'element-plus'
import _ from 'lodash'
import { gettoken } from '@/utils/abtoken'

// 接口类型和方法
interface BaseType {
  baseURL: string
  getConfigParams(): any
  interceptors(instance: AxiosInstance, url: string | number | undefined): any
  request(options: AxiosRequestConfig): any
}

interface AxiosRequestType extends RawAxiosRequestConfig {
  baseURL?: string
  url?: string | undefined
  data?: any
  params?: any
  method?: string
  headers?: any
  timeout?: number
  value?: any
  cancelToken?: any
  isShowLoading?: boolean
}
// 取消重复请求
const CancelToken = axios.CancelToken
// 用于存储每个请求的取消函数以及对应标识
let sources: any = []

// 取消函数
let removeSource = (config: any) => {
  for (let item in sources) {
    if (sources[item].umet === config.url + '&' + config.method) {
      sources[item].cancel('已取消重复请求，请勿重复请求')
      sources.splice(item, 1)
    }
  }
}

// loading对象
let loadingInstance: { close: () => void } | null
// 请求合并只出现一次loading
// 当前正在请求的数量
let loadingRequestCount = 0
//显示loading相关的函数 显示loading的函数 并且记录请求次数 ++
const showLoading = (target: any) => {
  if (loadingRequestCount === 0) {
    loadingInstance = ElLoading.service({
      lock: true,
      text: '加载中...',
      target: target,
      background: 'rgba(255,255,255,0.5)'
    })
  }
  loadingRequestCount++
}

// 隐藏loading的函数，并且记录请求次数
const hideLoading = () => {
  if (loadingRequestCount <= 0) {
    return
  }
  loadingRequestCount--
  if (loadingRequestCount === 0) {
    toHideLoading()
  }
}

// 防抖：将 300ms 间隔内的关闭 loading 便合并为一次. 防止连续请求时, loading闪烁的问题。
const toHideLoading = _.debounce(() => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  loadingInstance.close()
  loadingInstance = null
}, 300)

class AxiosHttpRequest implements BaseType {
  baseURL: string
  timeout: number
  constructor() {
    //this.baseURL = import.meta.env.VITE_APP_BASEURL
    this.baseURL = ''
    this.timeout = 1500
  }
  // 配置参数
  getConfigParams() {
    const config = {
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: { isShowLoading: true }
    }
    return config
  }
  // 拦截设置
  interceptors(instance: AxiosInstance, url: string | number | undefined) {
    // 请求拦截
    instance.interceptors.request.use(
      // (config: InternalAxiosRequestConfig) => {
      //   // 取消重复请求
      //   removeSource(config)
      //   config.cancelToken = new CancelToken((c) => {
      //     // 将取消函数存起来
      //     sources.push({ umet: config.url + '&' + config.method, cancel: c })
      //   })
      //   // 添加全局的loading..
      //   // 请求头携带token
      //   config.headers['Authorization'] = 'Bearer ' + gettoken('token')
      //   config.headers['Content-Type'] = 'application/json;charset=utf-8'
      //   // get请求映射params参数
      //   if (config.method === 'get' && config.params) {
      //     let url = config.url + '?'
      //     for (const propName of Object.keys(config.params)) {
      //       const value = config.params[propName]
      //       const part = encodeURIComponent(propName) + '='
      //       if (value !== null && typeof value !== 'undefined') {
      //         if (typeof value === 'object') {
      //           for (const key of Object.keys(value)) {
      //             let params = propName + '[' + key + ']'
      //             const subPart = encodeURIComponent(params) + '='
      //             url += subPart + encodeURIComponent(value[key]) + '&'
      //           }
      //         } else {
      //           url += part + encodeURIComponent(value) + '&'
      //         }
      //       }
      //     }
      //     url = url.slice(0, -1)
      //     config.params = {}
      //     config.url = url
      //   }
      //   return config
      // },
      (config: InternalAxiosRequestConfig) => {
        let loadingTarget = 'body'
        if (config.headers.loadingTarget) {
          loadingTarget = config.headers.loadingTarget
        }
        const isShowLoading = config.headers.isShowLoading
        const target = document.querySelector(loadingTarget)
        //if (target && isShowLoading) {
        if (target && isShowLoading) {
          // 请求拦截进来调用显示loading效果
          showLoading(loadingTarget)
        }
        removeSource(config)
        config.cancelToken = new CancelToken((c) => {
          // 将取消函数存起来
          sources.push({ umet: config.url + '&' + config.method, cancel: c })
        })
        const token = gettoken('token')
        if (token !== '') {
          config.headers['token'] = token
        }
        if (
          config.method === 'post' &&
          (config.headers as any)['Content-Type'] === 'application/x-www-form-urlencoded'
        ) {
          config.data = qs.stringify(config.data)
        }
        if (config.method === 'get' && config.params) {
          let url = config.url as string
          url += '?'
          const keys = Object.keys(config.params)
          for (const key of keys) {
            if (config.params[key] !== void 0 && config.params[key] !== null) {
              url += `${key}=${encodeURIComponent(config.params[key])}&`
            }
          }
          url = url.substring(0, url.length - 1)
          config.params = {}
          config.url = url
        }
        return config
      },
      (error: any) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截
    instance.interceptors.response.use(
      (res: any) => {
        setTimeout(() => {
          hideLoading()
        }, 200)
        // 取消重复请求
        removeSource(res.config)

        // 未设置状态码则默认成功状态
        const code = res.data['status'] || 200
        // 获取错误信息
        let msg = res.data['message'] || ''
        if (code === 200) {
          //ElMessage.success(msg)
          return Promise.resolve(res)
          //return Promise.resolve(res.data)
        }

        const networkErrMap: any = {
          '400': '错误的请求', // token 失效
          '401': '未授权，请重新登录',
          '403': '拒绝访问',
          '404': '请求错误，未找到该资源',
          '405': '请求方法未允许',
          '408': '请求超时',
          '500': '服务器端出错',
          '501': '网络未实现',
          '502': '网络错误',
          '503': '服务不可用',
          '504': '网络超时',
          '505': 'http版本不支持该请求'
        }
        if (code) {
          ElMessage.error(networkErrMap[code] ?? `其他连接错误 --${code}`)
        }
        const authErrMap: any = {
          '10031': '登录失效，需要重新登录', // token 失效
          '10032': '您太久没登录，请重新登录~', // token 过期
          '10033': '账户未绑定角色，请联系管理员绑定角色',
          '10034': '该用户未注册，请联系管理员注册用户',
          '10035': 'code 无法获取对应第三方平台用户',
          '10036': '该账户未关联员工，请联系管理员做关联',
          '10037': '账号已无效',
          '10038': '账号未找到'
        }
        if (code >= 1000) {
          ElMessage.error(authErrMap[code])
          // 授权错误，登出账户
          // logout();
        }
        ElMessage.error(msg)
        return Promise.reject(res.data)
      },
      (error: any) => {
        setTimeout(() => {
          hideLoading()
        }, 200)
        console.log('err' + error)
        let { message } = error
        if (message === 'Network Error') {
          message = '后端接口连接异常'
        } else if (message.includes('timeout')) {
          message = '系统接口请求超时'
        } else if (message.includes('Request failed with status code')) {
          message = '系统接口' + message.substr(message.length - 3) + '异常'
        }
        ElMessage.error({
          message: message,
          duration: 5 * 1000
        })

        return Promise.reject(error)
      }
    )
  }

  /**
   * 外部调用方法
   * @param options axios请求参数
   * @returns 实例
   */
  request(options: AxiosRequestType) {
    const instance = axios.create()
    options = Object.assign(this.getConfigParams(), options)
    this.interceptors(instance, options.url)
    return instance(options)
  }
}

// 实例化请求类
const http = new AxiosHttpRequest()

export default http
