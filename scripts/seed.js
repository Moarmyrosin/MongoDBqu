import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/modules/users/user.model.js';
import { Survey } from '../src/modules/surveys/survey.model.js';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/survey_system');
    await User.deleteMany({});
    await Survey.deleteMany({});

    const user = await User.create({ username: 'demo', password: 'password123' });

    const survey = await Survey.create({
      title: '示例问卷',
      description: '基础题型示例',
      status: 'draft',
      createdBy: user._id,
      settings: {
        allowAnonymous: true,
        allowMultipleResponses: true,
        loginRequiredToFill: true
      },
      questions: [
        {
          title: '你的性别',
          type: 'radio',
          required: true,
          order: 0,
          options: [
            { label: '男', value: 'male' },
            { label: '女', value: 'female' },
            { label: '其他', value: 'other' }
          ]
        },
        {
          title: '你喜欢的水果（多选，2-3个）',
          type: 'checkbox',
          required: true,
          order: 1,
          validationRule: { minSelected: 2, maxSelected: 3 },
          options: [
            { label: '苹果', value: 'apple' },
            { label: '香蕉', value: 'banana' },
            { label: '西瓜', value: 'watermelon' },
            { label: '葡萄', value: 'grape' }
          ]
        },
        {
          title: '年龄（整数，0-120）',
          type: 'number',
          required: true,
          order: 2,
          validationRule: { integer: true, min: 0, max: 120 }
        },
        {
          title: '建议或留言（文本，最多200字）',
          type: 'text',
          required: false,
          order: 3,
          validationRule: { maxLength: 200 }
        }
      ]
    });

    console.log('Seeded:', { user: user.username, surveyId: survey._id.toString() });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

run();
