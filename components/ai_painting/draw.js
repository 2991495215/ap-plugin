/*
 * @Author: 渔火Arcadia  https://github.com/yhArcadia
 * @Date: 2022-12-20 01:22:53
 * @LastEditors: 渔火Arcadia
 * @LastEditTime: 2022-12-30 01:46:49
 * @FilePath: \Yunzai-Bot\plugins\ap-plugin\components\ap\draw.js
 * @Description: 请求接口获取图片
 * 
 * Copyright (c) 2022 by 渔火Arcadia 1761869682@qq.com, All Rights Reserved. 
 */
import Config from "./config.js";
import cfg from '../../../../lib/config/config.js'
import NsfwCheck from "./nsfwcheck.js"
import moment from "moment";
import YAML from 'yaml'
import path from 'path';
import fs from 'fs';
import fetch from "node-fetch";
import { bs64Size } from '../../utils/utils.js';
import Log from '../../utils/Log.js'
import process from "process";
import { Pictools } from "../../utils/utidx.js";
class Draw {

    /**获取一张图片。返回base64
     * @param {object} paramdata 绘图参数
     * @return {object}  
     */
    async get_a_pic(paramdata) {
        // 读取接口地址和接口备注
        let config = await Config.getcfg()
        if (config.APIList.length == 0)
            return {
                code: 41,
                info: "未配置接口",
                msg: '',
                description: `当前无可用绘图接口，请先配置接口。\n配置指令： #ap添加接口\n参考文档：https://www.wolai.com/tiamcvmiaLJLePhTr4LAJE\n发送#ap说明书以查看详细说明`
            }
        let index = paramdata.specifyAPI || config.usingAPI
        let apiobj = config.APIList[index - 1]
        let api = Object.keys(apiobj)[0]      //接口
        let remark = Object.values(apiobj)[0] //接口备注

        // 请求图片
        let response
        try {
            response = await this.requestPic(paramdata.param, api)
        } catch (err) {
            // 处理错误
            if (err.code == "ETIMEDOUT")
                return {
                    code: 11,
                    info: "访问超时",
                    msg: err.message,
                    description: `接口${index}：${remark} 访问失败，请尝试使用其他接口`
                }
            else if (err.code == "ECONNREFUSED")
                return {
                    code: 12,
                    info: "连接被拒绝",
                    msg: err.message,
                    description: `接口${index}：${remark} 连接被服务区拒绝：ECONNREFUSED，请检查端口号或接口是否配置正确、服务器防火墙是否放行了对应端口，或尝试使用其他接口`
                }
            else if (err.code == "EPROTO")
                return {
                    code: 13,
                    info: "跨域",
                    msg: err.message,
                    description: `接口${index}：${remark} 协议错误：EPROTO，请检查接口是否填写正确（若服务器没有部署SSL证书，接口应当以http而不是https开头），或尝试使用其他接口`
                }
            else {
                let msg = {
                    code: 10,
                    info: "未知错位",
                    msg: err.message,
                    description: `接口${index}：${remark} 出现未知错误，请尝试使用其他接口。\n您可前往控制台查看错误日志，并反馈给开发者。`
                }
                Log.e('【request_err】：', err);
                Log.e('【request_err_message】：', err.message);
                Log.e('【request_err_code】：', err.code);
                Log.e(msg)
                return msg
            }
        }


        // 处理错误
        if (response.status != 200) {
            if (response.status == 404)
                return {
                    code: response.status,
                    info: "NotFound",
                    msg: response.statusText,
                    description: `接口${index}：${remark} 访问失败：404 NotFound。\n请检查接口连通性，或更换接口`
                }
            else if (response.status == 413)
                return {
                    code: response.status,
                    info: "请求体过大",
                    msg: response.statusText,
                    description: `错误：Request Entity Too Large\n请尝试使用其他图片`
                }
            else if (response.status == 500)
                return {
                    code: response.status,
                    info: "服务器内部错误",
                    msg: response.statusText,
                    description: `接口${index}：${remark} 服务器内部错误：Internal Server Error\n服务器可能崩溃，也可能是暂时性故障。请稍后尝试，或检查服务器状态。\n若确认服务器状态正常后依然持续出现此错误，您也可以向开发者反馈。`
                }
            else if (response.status == 502)
                return {
                    code: response.status,
                    info: "Bad Gateway",
                    msg: response.statusText,
                    description: `接口${index}：${remark} 错误：502 Bad Gateway\n若持续出现此错误，请检查stable diffusion是否添加了启动参数--api，或其他服务器错误\nhttps://product.pconline.com.cn/itbk/software/dnwt/1609/8402861.html`
                }
            else if (response.status == 503)
                return {
                    code: response.status,
                    info: "服务不可用",
                    msg: response.statusText,
                    description: `接口${index}：${remark} 服务不可用，请尝试使用其他接口。`
                }
            else if (response.status == 504)
                return {
                    code: response.status,
                    info: "超时",
                    msg: response.statusText,
                    description: `接口${index}：${remark} 超时：504 Gateway Time-out。\n如果频繁出现此错误，请检查绘图服务器状态，或更换接口`
                }
            else {
                let msg = {
                    code: response.status,
                    info: "未知错误",
                    msg: response.statusText,
                    description: `接口${index}：${remark} 出现未知错误，请尝试使用其他接口。\n您可前往控制台查看错误日志，并反馈给开发者。`
                }
                Log.e('【response_err】：', response)
                Log.e('【response_err_status】：' + response.status)
                Log.e('【response_err_statusText】：' + response.statusText)
                Log.e(msg)
                return msg
            }
        }


        // 提取base64
        let res = await response.json();
        // fs.writeFileSync(path.join(process.cwd(), 'resources/aptemp.json'), JSON.stringify(res, null, "\t"), "utf8");                  /*  */
        let base64 = res.images[0].toString().replace(/data:image\/png;|base64,/g, "");
        let resparam = res.parameters
        // 图片大小太小，判断为全黑故障图片
        let [b, imagesize, mb] = bs64Size(base64)
        if (imagesize < 10) {
            Log.w("图片损坏")
            return {
                code: 21,
                info: "黑图",
                msg: '',
                description: `图片损坏，请重试。`
            }
        }

        Log.m("图片获取成功")

        // 鉴黄
        let isnsfw = false
        if (paramdata.JH) {
            let jh = await NsfwCheck.check(base64)
            if (jh.message) {
                if (jh.message == "【aiPainting图片审核】本次百度图片审核超时")
                    return {
                        code: 32,
                        info: '百度图片审核超时',
                        msg: '',
                        description: jh.message
                    }
                else
                    return {
                        code: 31,
                        info: '鉴黄故障',
                        msg: '',
                        description: jh.message
                    }
            }
            isnsfw = jh.isnsfw
        }

        // 图片信息
        let picinfo = await Pictools.getPicInfo(base64, true)


        //下载图片
        this.downLoadPic(paramdata, resparam.seed, base64)

        return {
            code: 0,
            isnsfw: isnsfw,
            seed: resparam.seed,
            size: picinfo.size,
            md5: picinfo.md5,
            base64: base64
        }
    }


    /**请求绘图接口 
     * @param {object} param 绘图的参数
     * @param {string} api 接口地址
     * @return {object}  请求结果 response
     */
    async requestPic(param, api) {
        // Log.i(param)                                 /*  */
        let ntags = "nsfw, nsfw, (nsfw:1.4), nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry"
        if (param.ntags != "默认")
            ntags = param.ntags
        let seed = param.seed
        if (seed == -1) {
            seed = Math.floor(Math.random() * 2147483647)
        }
        // 请求接口判断是否存在指定sampler 
        if (param.sampler != 'Euler a') {
            try {
                let res = await fetch(api + `/sdapi/v1/samplers`)
                res = await res.json()
                let exist = false
                for (let val of res) {
                    if (val.name == param.sampler) {
                        exist = true
                        break
                    }
                }
                Log.i(`指定的采样器${param.sampler}：${exist ? '存在' : '不存在'}`)
                if (!exist)
                    param.sampler = 'Euler a'
            } catch (err) {
                param.sampler = 'Euler a'
            }
        }

        Log.m("尝试获取一张图片，使用接口：", api)
        let data;
        // 文生图
        if (!param.base64) {
            data = {
                "enable_hr": false,
                "denoising_strength": 0,
                "firstphase_width": 0,
                "firstphase_height": 0,
                "styles": ["string"],
                // "subseed": -1,
                // "subseed_strength": 0,
                // "seed_resize_from_h": -1,
                // "seed_resize_from_w": -1,
                "batch_size": 1,
                "n_iter": 1,
                "restore_faces": false,
                "tiling": false,
                "eta": 0,
                "s_churn": 0,
                "s_tmax": 0,
                "s_tmin": 0,
                "s_noise": 1,
                "override_settings": {},
                "prompt": param.tags,
                "seed": seed,
                "steps": param.steps,
                "cfg_scale": param.scale,
                "height": param.height,
                "width": param.width,
                "negative_prompt": ntags,
                "sampler_index": param.sampler,
            }
        }
        // 图生图
        else {
            data = {
                "init_images": ['data:image/jpeg;base64,' + param.base64],
                "sampler_index": param.sampler,
                "denoising_strength": param.strength,
                "prompt": param.tags,
                "seed": seed,
                "steps": param.steps,
                "cfg_scale": param.scale,
                "width": param.width,
                "height": param.height,
                "negative_prompt": ntags,
                "styles": ["string"],
            }
        }

        let res = await fetch(api + `/sdapi/v1/${param.base64 ? "img" : "txt"}2img`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authorization': 'Bearer',
                'token': `token_test_${cfg.qq}`
            },
            body: JSON.stringify(data),
        })
        // console.log(res)
        return res
    }

    /**下载图片
     * @param {object} paramdata 绘图参数
     * @param {string} base64 图片bs64
     * @return {*}
     */
    async downLoadPic(paramdata, seed, base64) {
        let param = paramdata.param
        let policy = await Config.getPolicy()
        if (!policy.isDownload || paramdata.message == "二次元的我") return false

        let currentTime = moment(new Date()).format("YYMMDD_HHmmss");
        let picname = `${currentTime}_${("Tags=" + param.tags + "&nTags=" + param.ntags).substring(0, 170).trim()}&seed=${seed}&user=${paramdata.user}.png`
        let picPath = path.join(process.cwd(), 'resources/yuhuo/aiPainting', picname);
        fs.writeFile(picPath, base64, "base64", (err) => { if (err) throw err });
    }
}

export default new Draw()