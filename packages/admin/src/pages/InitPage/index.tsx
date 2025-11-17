import Footer from '@/components/Footer';
import { fetchInit } from '@/services/van-blog/api';
import ProCard from '@ant-design/pro-card';
import { ProFormInstance } from '@ant-design/pro-form';
import { Alert, Modal, Upload, Button, message, Space } from 'antd';
import { useHistory } from 'umi';
//@ts-ignore
import styles from './index.less';

import { ProFormText, StepsForm } from '@ant-design/pro-components';

import SiteInfoForm from '@/components/SiteInfoForm';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import { useRef, useState } from 'react';

const InitPage = () => {
  const history = useHistory();
  const [mode, setMode] = useState<'select' | 'setup'>('select');
  const [restoring, setRestoring] = useState(false);
  const formMapRef = useRef<React.MutableRefObject<ProFormInstance<any> | undefined>[]>([]);
  const formRef1 = useRef<ProFormInstance>();
  const formRef2 = useRef<ProFormInstance>();
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <ProCard
          title={
            <div>
              <p style={{ fontSize: 20, marginBottom: 0 }}>欢迎使用 VanBlog 个人博客系统</p>
              <a
                target={'_blank'}
                rel="noreferrer"
                href="https://vanblog.mereith.com/feature/basic/setting.html"
              >
                帮助文档
              </a>
            </div>
          }
        >
          {mode === 'select' && (
            <ProCard style={{ marginBottom: 16 }}>
              <Alert type="info" message="选择一种初始化方式" style={{ marginBottom: 8 }} />
              <Space>
                <Upload
                  showUploadList={false}
                  name="file"
                  accept=".json"
                  action="/api/admin/init/restore"
                  disabled={restoring}
                  onChange={(info) => {
                    if (info.file.status === 'uploading') {
                      setRestoring(true);
                      message.loading({ content: '正在恢复备份…', key: 'restore', duration: 0 });
                    } else if (info.file.status === 'done') {
                      setRestoring(false);
                      message.success({ content: '备份恢复成功！', key: 'restore' });
                      history.push('/welcome');
                    } else if (info.file.status === 'error') {
                      setRestoring(false);
                      message.error({ content: '备份恢复失败', key: 'restore' });
                    }
                  }}
                >
                  <Button type="primary" disabled={restoring}>使用备份数据恢复</Button>
                </Upload>
                <Button onClick={() => setMode('setup')} disabled={restoring}>配置新系统</Button>
              </Space>
            </ProCard>
          )}
          {mode === 'setup' && (
            <StepsForm
              formMapRef={formMapRef}
              onFinish={async (values) => {
                const { name, password, ...siteInfo } = values;
                const newData = {
                  user: {
                  username: name,
                  password: encryptPwd(name, password),
                },
                siteInfo,
              };
              const res = await fetchInit(newData);
              if (res?.statusCode == 200 || res?.statusCode == 500) {
                Modal.success({
                  title: '初始化成功!',
                  content:
                    '首次使用请记得去后台 “站点管理/评论管理” 中注册一下评论系统的管理员账号哦！评论通知等设置可在 “系统设置/评论设置” 中找到。',
                  onOk: () => {
                    history.push('/user/login');
                  },
                  onCancel: () => {
                    history.push('/user/login');
                  },
                });
                return true;
              }
              return false;
            }}
              submitter={{
                render: (props, dom) => (
                  <Space>
                    {props?.step === 0 && (
                      <Button key="back" onClick={() => setMode('select')}>上一步</Button>
                    )}
                    {Array.isArray(dom) ? dom : [dom]}
                  </Space>
                ),
              }}
            >
            <StepsForm.StepForm name="step1" title="配置用户">
              <Alert
                type="info"
                message="初始化页面所有配置都可在初始化后进入后台修改。"
                style={{ marginBottom: 8 }}
              ></Alert>
              <ProFormText
                name="name"
                required={true}
                rules={[{ required: true, message: '这是必填项' }]}
                label="登录用户名"
                placeholder={'请输入登录用户名'}
              ></ProFormText>
              {/* <ProFormText
                name="nickname"
                required={true}
                rules={[{ required: true, message: '这是必填项' }]}
                label="昵称"
                placeholder={'请输入昵称（显示的名字）'}
              ></ProFormText> */}
              <ProFormText.Password
                name="password"
                required={true}
                rules={[{ required: true, message: '这是必填项' }]}
                label="登录密码"
                placeholder={'请输入登录密码'}
              ></ProFormText.Password>
            </StepsForm.StepForm>
            <StepsForm.StepForm
              name="step2"
              title={'基本配置'}
              formRef={formRef1}
              onFinish={async (values) => {
                let ok = true;
                try {
                  new URL(values.baseUrl);
                } catch (err) {
                  ok = false;
                }
                if (!ok) {
                  Modal.warn({
                    title: '网站 URL 不合法！',
                    content: (
                      <div>
                        <p>请输入包含完整协议的 URL</p>
                        <p>例: https://blog-demo.mereith.com</p>
                      </div>
                    ),
                  });
                  return false;
                }
                return true;
              }}
            >
              <Alert
                type="info"
                message="默认的上传图片会到内置图床，如需配置 oss 图床，可在初始化后去设置页更改。初始化页面所有配置都可在初始化后进入后台修改。"
                style={{ marginBottom: 8 }}
              ></Alert>
              <SiteInfoForm
                showRequire={true}
                showOption={false}
                showLayout={false}
                form={formRef1}
                isInit={true}
              />
            </StepsForm.StepForm>
            <StepsForm.StepForm name="step3" title={'高级配置'} formRef={formRef2}>
              <Alert
                type="info"
                message="默认的上传图片会到内置图床，如需配置 oss 图床，可在初始化后去设置页更改。初始化页面所有配置都可在初始化后进入后台修改。"
                style={{ marginBottom: 8 }}
              ></Alert>
              <SiteInfoForm
                showRequire={false}
                showOption={true}
                showLayout={false}
                form={formRef2}
                isInit={true}
              />
            </StepsForm.StepForm>
            <StepsForm.StepForm name="step4" title={'布局配置'}>
              <Alert
                type="info"
                message="初始化页面所有配置都可在初始化后进入后台修改。"
                style={{ marginBottom: 8 }}
              ></Alert>
              <SiteInfoForm
                isInit={true}
                showRequire={false}
                showOption={false}
                showLayout={true}
                form={null}
              />
            </StepsForm.StepForm>
            </StepsForm>
          )}
        </ProCard>
      </div>
      <Footer />
    </div>
  );
};
export default InitPage;
