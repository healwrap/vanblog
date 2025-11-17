import { getWalineConfig, updateWalineConfig } from '@/services/van-blog/api';
import {
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useState } from 'react';
export default function (props: {}) {
  const [enableEmail, setEnableEmail] = useState<any>(false);
  const [akismetEnabled, setAkismetEnabled] = useState<boolean>(false);
  const [akismetKey, setAkismetKey] = useState<string>('');
  const [forbiddenWords, setForbiddenWords] = useState<string>('');
  const [ipqps, setIpqps] = useState<number>();
  return (
    <>
      <ProForm
        grid={true}
        layout={'horizontal'}
        labelCol={{ span: 6 }}
        request={async (params) => {
          const { data } = await getWalineConfig();
          setEnableEmail(data?.['smtp.enabled'] || false);
          const akOn = data?.['akismet.enabled'] && data['akismet.enabled'] !== false
            ? true
            : Boolean(data?.['akismet.key'] && data['akismet.key'] !== 'false');
          setAkismetEnabled(Boolean(akOn));
          setAkismetKey(String(data?.['akismet.key'] || ''));
          setForbiddenWords(String(data?.['forbidden.words'] || ''));
          setIpqps(Number(data?.ipqps ?? 60));
          if (!data) {
            return {
              'smtp.enabled': false,
              forceLoginComment: false,
            };
          }
          return { ...data };
        }}
        syncToInitialValues={true}
        onFinish={async (data) => {
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({ title: '演示站禁止修改 waline 配置！' });
            return;
          }
          let baseOC: any = {};
          if (data.otherConfig) {
            try {
              baseOC = JSON.parse(data.otherConfig);
            } catch (err) {
              Modal.info({ title: '自定义环境变量不是合法 JSON 格式！' });
              return;
            }
          }
          if (akismetEnabled) {
            if (!akismetKey || akismetKey.trim() === '') {
              Modal.info({ title: '请填写 Akismet Key 或关闭 Akismet 检测' });
              return;
            }
          }
          const newOC: any = { ...baseOC };
          data['akismet.enabled'] = akismetEnabled as any;
          data['akismet.key'] = akismetKey?.trim();
          data['forbidden.words'] = forbiddenWords?.trim();
          data['ipqps'] = ipqps as any;
          data.otherConfig = JSON.stringify(newOC);
          setEnableEmail(data?.['smtp.enabled'] || false);
          await updateWalineConfig(data);
          message.success('更新成功！');
        }}
      >
        <ProFormText
          name="webhook"
          label="评论后的 webhook 地址"
          tooltip={'收到评论后会向此地址发送一条携带评论信息的 HTTP 请求'}
          placeholder="评论后的 webhook 地址"
        />
        <ProFormSelect
          fieldProps={{
            options: [
              {
                label: '开启',
                value: true as any,
              },
              {
                label: '关闭',
                value: false as any,
              },
            ],
          }}
          name="forceLoginComment"
          label="是否强制登录后评论"
          placeholder={'是否强制登录后评论，默认关闭'}
        ></ProFormSelect>
        <ProFormDigit
          name="ipqps"
          label="评论间隔（秒）"
          placeholder="10"
          fieldProps={{
            value: ipqps,
            onChange: (v) => setIpqps(Number(v)),
          }}
        />
        <ProFormSelect
          fieldProps={{
            options: [
              { label: '开启', value: true as any },
              { label: '关闭', value: false as any },
            ],
            value: akismetEnabled,
            onChange: (v) => setAkismetEnabled(Boolean(v)),
          }}
          name="akismet.enabled"
          label="Akismet 垃圾评论检测"
          tooltip={'开启后使用 Akismet 服务判定垃圾评论。开发环境建议关闭。'}
          placeholder={'默认关闭'}
        ></ProFormSelect>
        {akismetEnabled && (
          <ProFormText
            name="akismet.key"
            label="Akismet Key"
            tooltip={'在 Akismet 官网申请获得的 API Key。'}
            placeholder="请输入 Akismet Key"
            fieldProps={{
              value: akismetKey,
              onChange: (e) => setAkismetKey(e.target.value),
            }}
          />
        )}
        <ProFormText
          name="forbidden.words"
          label="违禁词（逗号分隔）"
          tooltip={'填写后命中关键词的评论会被判为垃圾评论。例：word1,word2'}
          placeholder="word1,word2"
          fieldProps={{
            value: forbiddenWords,
            onChange: (e) => setForbiddenWords(e.target.value),
          }}
        />
        <ProFormSelect
          fieldProps={{
            onChange: (target) => {
              console.log(target);
              setEnableEmail(target);
            },
            options: [
              {
                label: '开启',
                value: true as any,
              },
              {
                label: '关闭',
                value: false as any,
              },
            ],
          }}
          name="smtp.enabled"
          label="是否启用邮件通知"
          tooltip="启用后新评论会通知博主，被回复时会通知填写邮箱的被回复者"
          placeholder={'默认关闭'}
        ></ProFormSelect>
        {enableEmail && (
          <>
            <ProFormText
              name="smtp.host"
              label="SMTP 地址(host)"
              tooltip={'发送邮件使用的 smtp 地址'}
              placeholder="请输入发送邮件使用的 smtp 地址"
              rules={[{ required: true, message: '这是必填项' }]}
            />
            <ProFormDigit
              name="smtp.port"
              label="SMTP 端口号"
              tooltip={'发送邮件使用的 smtp 端口号'}
              placeholder="请输入发送邮件使用的 smtp 端口号"
              rules={[{ required: true, message: '这是必填项' }]}
            />
            <ProFormText
              name="smtp.user"
              label="SMTP 用户名"
              tooltip={'发送邮件使用的 smtp 用户名'}
              placeholder="请输入发送邮件使用的 smtp 用户名"
              rules={[{ required: true, message: '这是必填项' }]}
            />
            <ProFormText.Password
              name="smtp.password"
              label="SMTP 密码"
              tooltip={'发送邮件使用的 smtp 密码'}
              placeholder="请输入发送邮件使用的 smtp 密码"
              rules={[{ required: true, message: '这是必填项' }]}
            />
            <ProFormText
              name="authorEmail"
              label="博主邮箱"
              tooltip={'用来通知博主有新评论'}
              placeholder="用来通知博主有新评论"
              rules={[{ required: true, message: '这是必填项' }]}
            />
            <ProFormText
              name="sender.name"
              label="自定义发送邮件的发件人"
              tooltip={'自定义发送邮件的发件人'}
              placeholder="自定义发送邮件的发件人"
            />
            <ProFormText
              name="sender.email"
              label="自定义发送邮件的发件地址"
              tooltip={'自定义发送邮件的发件地址'}
              placeholder="自定义发送邮件的发件地址"
            />
          </>
        )}
        <ProFormTextArea
          name="otherConfig"
          label={
            <a
              href="https://waline.js.org/reference/server.html"
              target={'_blank'}
              rel="norefferrer"
            >
              自定义环境变量
            </a>
          }
          tooltip={'json 格式的键值对，会传递个 waline 作为环境变量'}
          placeholder="json 格式的键值对，会传递个 waline 作为环境变量"
          fieldProps={{
            autoSize: {
              minRows: 10,
              maxRows: 30,
            },
          }}
        />
      </ProForm>
    </>
  );
}
