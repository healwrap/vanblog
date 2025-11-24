import { ProForm, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { getAISetting, updateAISetting } from '@/services/van-blog/api';
import { Alert, Card, message, Modal } from 'antd';

export default function () {
  return (
      <Card title="AI 功能设置">
        <Alert
          type="info"
          message={
            <div>
              <p>在这里可以配置用于文章简介生成功能的 AI 服务。</p>
              <p>未开启或未完整配置时，尝试使用 AI 生成功能会提示：请先配置AI功能。</p>
            </div>
          }
          style={{ marginBottom: 8 }}
        />
        <ProForm
          grid={true}
          layout="horizontal"
          request={async () => {
            try {
              const { data } = await getAISetting();
              return (
                data || {
                  enabled: false,
                  endpoint: '',
                  apiKey: '',
                  model: '',
                  timeout: 15000,
                }
              );
            } catch (err) {
              return {
                enabled: false,
                endpoint: '',
                apiKey: '',
                model: '',
                timeout: 15000,
              };
            }
          }}
          syncToInitialValues={true}
          onFinish={async (values) => {
            if (location.hostname === 'blog-demo.mereith.com') {
              Modal.info({ title: '演示站禁止修改 AI 设置！' });
              return;
            }
            await updateAISetting(values);
            message.success('更新成功！');
          }}
        >
          <ProFormSelect
            name="enabled"
            label="启用 AI 功能"
            fieldProps={{
              options: [
                { label: '开启', value: true },
                { label: '关闭', value: false },
              ],
            }}
            tooltip="关闭后，编辑器中的 AI 简介按钮将无法正常使用，并提示请先配置AI功能。"
          />
          <ProFormText
            name="endpoint"
            label="AI 接口地址"
            placeholder="例如：https://api.openai.com/v1"
            tooltip="请填写兼容 OpenAI Chat Completions 的服务地址（不包含 /chat/completions 路径）。"
          />
          <ProFormText.Password
            name="apiKey"
            label="API Key"
            fieldProps={{
              autoComplete: 'new-password',
            }}
          />
          <ProFormText
            name="model"
            label="模型名称"
            placeholder="例如：gpt-3.5-turbo"
          />
          <ProFormDigit
            name="timeout"
            label="请求超时时间（毫秒）"
            placeholder="默认为 15000"
          />
          <ProFormTextArea
            name="note"
            label="备注"
            placeholder="可选，用于记录此 AI 配置的说明，不影响功能。"
            fieldProps={{
              autoSize: { minRows: 2, maxRows: 4 },
            }}
          />
        </ProForm>
      </Card>
  );
}


