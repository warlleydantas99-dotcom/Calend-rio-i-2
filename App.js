
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, ImageBackground, StyleSheet, Alert, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const chaveData = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function adicionarDias(data, quantidade) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + quantidade);
  return nova;
}

// Calcula a Páscoa pelo método gregoriano.
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function criarFeriados() {
  const resultado = {};

  const fixos = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Consciência Negra'],
    ['12-25', 'Natal'],
  ];

  for (let ano = 2026; ano <= 2030; ano++) {
    fixos.forEach(([data, nome]) => {
      resultado[`${ano}-${data}`] = nome;
    });

    const pascoa = calcularPascoa(ano);
    const datas = [
      [adicionarDias(pascoa, -48), 'Carnaval - ponto facultativo'],
      [adicionarDias(pascoa, -47), 'Carnaval - ponto facultativo'],
      [adicionarDias(pascoa, -46), 'Quarta-feira de Cinzas - ponto facultativo'],
      [adicionarDias(pascoa, -2), 'Paixão de Cristo'],
      [pascoa, 'Páscoa'],
      [adicionarDias(pascoa, 60), 'Corpus Christi - ponto facultativo'],
    ];

    datas.forEach(([data, nome]) => {
      resultado[chaveData(data)] = nome;
    });
  }

  return resultado;
}

const FERIADOS = criarFeriados();

export default function App() {
  const hoje = new Date();

  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [selecionado, setSelecionado] = useState(chaveData(hoje));
  const [eventos, setEventos] = useState([]);
  const [modal, setModal] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [horario, setHorario] = useState('09:00');
  const [foto, setFoto] = useState(null);

  useEffect(() => {
    carregarEventos();
    configurarNotificacoes();
  }, []);

  async function carregarEventos() {
    try {
      const dados = await AsyncStorage.getItem('agenda_eventos');
      if (dados) setEventos(JSON.parse(dados));
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os eventos.');
    }
  }

  async function configurarNotificacoes() {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('eventos', {
          name: 'Lembretes de eventos',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      }
      await Notifications.requestPermissionsAsync();
    } catch (e) {
      console.log('Notificações:', e);
    }
  }

  async function salvarLista(novaLista) {
    setEventos(novaLista);
    await AsyncStorage.setItem('agenda_eventos', JSON.stringify(novaLista));
  }

  function mudarMes(valor) {
    const novaData = new Date(ano, mes + valor, 1);
    setMes(novaData.getMonth());
    setAno(novaData.getFullYear());
  }

  function novoEvento() {
    setTitulo('');
    setDescricao('');
    setHorario('09:00');
    setFoto(null);
    setModal(true);
  }

  async function escolherFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso às fotos.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!resultado.canceled) {
      setFoto(resultado.assets[0].uri);
    }
  }

  async function adicionarEvento() {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Digite o título do evento.');
      return;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
      Alert.alert('Horário inválido', 'Digite no formato 09:30.');
      return;
    }

    const [hora, minuto] = horario.split(':').map(Number);
    const dataEvento = new Date(`${selecionado}T00:00:00`);
    dataEvento.setHours(hora, minuto, 0, 0);

    const evento = {
      id: String(Date.now()),
      date: selecionado,
      title: titulo.trim(),
      description: descricao,
      time: horario,
      photo: foto,
      notificationId: null,
    };

    try {
      if (dataEvento > new Date()) {
        const permissao = await Notifications.getPermissionsAsync();

        if (permissao.granted) {
          evento.notificationId =
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `Lembrete: ${evento.title}`,
                body: evento.description || 'Você tem um evento marcado!',
                sound: 'default',
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: dataEvento,
                ...(Platform.OS === 'android' ? { channelId: 'eventos' } : {}),
              },
            });
        }
      }

      await salvarLista([...eventos, evento]);
      setModal(false);
    } catch (erro) {
      Alert.alert('Erro', 'Não foi possível salvar o evento.');
    }
  }

  async function excluirEvento(evento) {
    try {
      if (evento.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          evento.notificationId
        );
      }

      await salvarLista(eventos.filter(e => e.id !== evento.id));
    } catch {
      Alert.alert('Erro', 'Não foi possível excluir o evento.');
    }
  }

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDia = new Date(ano, mes, 1).getDay();

  const celulas = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  while (celulas.length % 7 !== 0) celulas.push(null);

  const eventosDoDia = eventos.filter(e => e.date === selecionado);

  return (
    <View style={estilos.tela}>
      <Text style={estilos.logo}>
        Agenda<Text style={{ color: '#FFD600' }}>+</Text>
      </Text>
      <Text style={estilos.subtitulo}>SEU TEMPO, ORGANIZADO</Text>

      <View style={estilos.cabecalho}>
        <TouchableOpacity onPress={() => mudarMes(-1)}>
          <Text style={estilos.seta}>‹</Text>
        </TouchableOpacity>

        <Text style={estilos.mes}>
          {MESES[mes]} {ano}
        </Text>

        <TouchableOpacity onPress={() => mudarMes(1)}>
          <Text style={estilos.seta}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={estilos.calendario}>
        {DIAS.map(d => (
          <Text key={d} style={estilos.diaSemana}>{d}</Text>
        ))}

        {celulas.map((dia, indice) => {
          if (!dia) {
            return <View key={`vazio-${indice}`} style={estilos.celula} />;
          }

          const data = chaveData(new Date(ano, mes, dia));
          const lista = eventos.filter(e => e.date === data);
          const imagem = lista.find(e => e.photo)?.photo;
          const escolhido = selecionado === data;
          const feriado = FERIADOS[data];

          return (
            <TouchableOpacity
              key={data}
              style={[
                estilos.celula,
                escolhido && estilos.diaSelecionado,
              ]}
              onPress={() => setSelecionado(data)}
            >
              {imagem ? (
                <ImageBackground
                  source={{ uri: imagem }}
                  style={estilos.fundoFoto}
                  imageStyle={{ borderRadius: 8 }}
                >
                  <Text style={estilos.numero}>{dia}</Text>
                  {lista.length > 0 && <View style={estilos.barraVermelha} />}
                  {lista.length > 1 && (
                    <Text style={estilos.contador}>+{lista.length - 1}</Text>
                  )}
                </ImageBackground>
              ) : (
                <View style={estilos.conteudoDia}>
                  <Text style={estilos.numero}>{dia}</Text>
                  {lista.length > 0 && <View style={estilos.barraVermelha} />}
                  {feriado && <View style={estilos.pontoFeriado} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={estilos.linhaEventos}>
        <Text style={estilos.tituloSecao}>Eventos do dia</Text>
        <TouchableOpacity style={estilos.botaoAdicionar} onPress={novoEvento}>
          <Text style={estilos.textoBotao}>+ Adicionar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={estilos.lista}>
        {FERIADOS[selecionado] && (
          <View style={estilos.cartaoFeriado}>
            <Text style={estilos.textoFeriado}>
              🎉 {FERIADOS[selecionado]}
            </Text>
          </View>
        )}

        {eventosDoDia.length === 0 && !FERIADOS[selecionado] && (
          <Text style={estilos.vazio}>Nenhum evento neste dia.</Text>
        )}

        {eventosDoDia.map(evento => (
          <View key={evento.id} style={estilos.cartaoEvento}>
            {evento.photo && (
              <ImageBackground
                source={{ uri: evento.photo }}
                style={estilos.fotoEvento}
                imageStyle={{ borderRadius: 8 }}
              />
            )}

            <View style={{ flex: 1 }}>
              <Text style={estilos.nomeEvento}>{evento.title}</Text>
              <Text style={estilos.horaEvento}>{evento.time}</Text>
              {!!evento.description && (
                <Text style={estilos.descricaoEvento}>
                  {evento.description}
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={() => excluirEvento(evento)}>
              <Text style={estilos.excluir}>Excluir</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={estilos.fundoModal}>
          <View style={estilos.modal}>
            <Text style={estilos.tituloModal}>Novo evento</Text>
            <Text style={estilos.dataModal}>Data: {selecionado}</Text>

            <TextInput
              style={estilos.input}
              placeholder="Título do evento"
              placeholderTextColor="#999"
              value={titulo}
              onChangeText={setTitulo}
            />

            <TextInput
              style={estilos.input}
              placeholder="Descrição"
              placeholderTextColor="#999"
              value={descricao}
              onChangeText={setDescricao}
            />

            <TextInput
              style={estilos.input}
              placeholder="Horário (09:00)"
              placeholderTextColor="#999"
              value={horario}
              onChangeText={setHorario}
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity
              style={estilos.botaoFoto}
              onPress={escolherFoto}
            >
              <Text style={estilos.textoFoto}>
                {foto ? '✓ Foto selecionada' : '📷 Escolher foto'}
              </Text>
            </TouchableOpacity>

            {foto && (
              <ImageBackground
                source={{ uri: foto }}
                style={estilos.previa}
                imageStyle={{ borderRadius: 8 }}
              />
            )}

            <TouchableOpacity
              style={estilos.botaoSalvar}
              onPress={adicionarEvento}
            >
              <Text style={estilos.textoSalvar}>Salvar evento</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={estilos.cancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1, backgroundColor: '#101010',
    paddingTop: 48, paddingHorizontal: 12,
  },
  logo: {
    color: '#fff', fontSize: 30, fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitulo: {
    color: '#999', fontSize: 10, letterSpacing: 3,
    textAlign: 'center', marginBottom: 18,
  },
  cabecalho: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  mes: { color: '#FFD600', fontSize: 20, fontWeight: 'bold' },
  seta: { color: '#FFD600', fontSize: 34, paddingHorizontal: 12 },
  calendario: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 4,
  },
  diaSemana: {
    width: '14.2857%', color: '#FFD600',
    textAlign: 'center', paddingVertical: 8, fontWeight: 'bold',
  },
  celula: { width: '14.2857%', height: 58, padding: 2 },
  conteudoDia: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#242424', borderRadius: 8,
  },
  diaSelecionado: {
    borderWidth: 2, borderColor: '#FFD600', borderRadius: 9,
  },
  fundoFoto: {
    flex: 1, justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 3, overflow: 'hidden',
  },
  numero: {
    color: '#fff', fontWeight: 'bold', fontSize: 14,
    textShadowColor: '#000', textShadowRadius: 5,
  },
  barraVermelha: {
    height: 4, width: '65%', backgroundColor: '#FF3030',
    borderRadius: 5, marginBottom: 4,
  },
  contador: {
    color: '#fff', backgroundColor: '#000A',
    fontSize: 9, paddingHorizontal: 4, borderRadius: 5,
    position: 'absolute', bottom: 4, right: 3,
  },
  pontoFeriado: {
    width: 5, height: 5, borderRadius: 5,
    backgroundColor: '#FFD600', position: 'absolute', bottom: 5,
  },
  linhaEventos: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 16, marginBottom: 10,
  },
  tituloSecao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  botaoAdicionar: {
    backgroundColor: '#FFD600', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 13,
  },
  textoBotao: { color: '#111', fontWeight: 'bold' },
  lista: { flex: 1 },
  vazio: { color: '#888', textAlign: 'center', marginTop: 25 },
  cartaoEvento: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#222', padding: 10,
    borderRadius: 10, marginBottom: 8, gap: 10,
  },
  fotoEvento: { width: 55, height: 55 },
  nomeEvento: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  horaEvento: { color: '#FFD600', marginTop: 3 },
  descricaoEvento: { color: '#bbb', marginTop: 3 },
  excluir: { color: '#ff5555', padding: 5 },
  cartaoFeriado: {
    backgroundColor: '#29230A', padding: 12,
    borderRadius: 9, marginBottom: 8,
  },
  textoFeriado: { color: '#FFD600', fontWeight: 'bold' },
  fundoModal: {
    flex: 1, backgroundColor: '#000B',
    justifyContent: 'center', padding: 16,
  },
  modal: { backgroundColor: '#1D1D1D', padding: 18, borderRadius: 16 },
  tituloModal: {
    color: '#FFD600', fontSize: 22,
    fontWeight: 'bold', marginBottom: 8,
  },
  dataModal: { color: '#ccc', marginBottom: 12 },
  input: {
    backgroundColor: '#303030', color: '#fff',
    padding: 12, borderRadius: 8, marginBottom: 10,
  },
  botaoFoto: {
    backgroundColor: '#333', padding: 12,
    borderRadius: 8, alignItems: 'center',
  },
  textoFoto: { color: '#FFD600', fontWeight: 'bold' },
  previa: { height: 90, marginTop: 10 },
  botaoSalvar: {
    backgroundColor: '#FFD600', padding: 14,
    borderRadius: 8, alignItems: 'center', marginTop: 14,
  },
  textoSalvar: { color: '#111', fontWeight: 'bold' },
  cancelar: { color: '#fff', textAlign: 'center', marginTop: 14 },
});
