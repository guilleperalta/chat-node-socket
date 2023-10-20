import express from "express"
import logger from "morgan"
import db from "../config/db.js"
import { Server } from "socket.io"
import { createServer } from "node:http"
import {DataTypes , Sequelize} from 'sequelize'

const port = process.env.PORT
const app = express()
const server = createServer(app)
const io = new Server(server , {
    connectionStateRecovery: {}
})

try {
    await db.authenticate();
    db.sync()
    console.log('Conexión Correcta a la Base de datos')
} catch (error) {
    console.log(error)
}

const messages = db.define('messages', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    content: {
        type: DataTypes.STRING,
    },
    user: {
        type: DataTypes.TEXT
    },
});

io.on('connection' , async (socket) => {
    console.log('Un usuario se acaba de conectar')
    
    socket.on('disconnect' , () => {
        console.log('Un usuario se acaba de desconectar')
    })

    socket.on('chat message' , async (msg) => {
        try {
            const message = await messages.create({
                user: socket.handshake.auth.username,
                content: msg
            })
        } catch (error) {
            console.log(error)
            return
        }
        const lastMsgId = await messages.max('id')
        const horaMsg = await messages.findOne({
            where: {
                id: lastMsgId
            },
        });
        io.emit('chat message' , msg , lastMsgId , socket.handshake.auth.username , horaMsg.createdAt)
    })

    if (!socket.recovered) {
        try {
            const resultadosPrevios = await messages.findAll({
                where: {
                    id: {
                        [Sequelize.Op.gt]: socket.handshake.auth.serverOffset ?? 0,
                      },
                },
            });
            resultadosPrevios.forEach(resultado => {
                socket.emit('chat message' , resultado.content , resultado.id , resultado.user , resultado.createdAt)
            });
        } catch (error) {
            console.log(error)
            return
        }
    }
})

app.use(logger('dev'))

app.get('/' , (req,res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port , () => {
    console.log(`Server corriendo en el puerto ${port}`)
})