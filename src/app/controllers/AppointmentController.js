import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';

class AppointmentController {
  async index(req, res) {
    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.status(200).json(appointments);
  }

  async store(req, res) {
    try {
      const schema = Yup.object().shape({
        provider_id: Yup.number().required(),
        date: Yup.date().required(),
      });

      if (!(await schema.isValid(req.body))) {
        return res.json(400).json({ error: 'Validation failed!' });
      }

      const { provider_id, date } = req.body;

      // Check if provider_id is a provider
      const isProvider = await User.findOne({
        where: { id: provider_id, provider: true },
      });

      if (!isProvider) {
        return res
          .status(401)
          .json({ error: 'You can only create appointments with providers!' });
      }

      const hourStart = startOfHour(parseISO(date));

      // Check for past dates
      if (isBefore(hourStart, new Date())) {
        return res.status(400).json({ error: 'Past dates are not allowed' });
      }

      // Check date availability
      const checkAvailability = await Appointment.findOne({
        where: { provider_id, canceled_at: null, date: hourStart },
      });

      if (checkAvailability) {
        return res.status(400).json({ error: 'Appoint date is not available' });
      }

      const appointment = await Appointment.create({
        user_id: req.userId,
        provider_id,
        date: hourStart,
      });

      return res.status(200).json(appointment);
    } catch (error) {
      return res.status(500).json(error);
    }
  }
}

export default new AppointmentController();
