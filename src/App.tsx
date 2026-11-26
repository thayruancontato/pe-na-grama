
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
const PublicForm = lazy(() => import('./pages/PublicForm'));
const SchoolSystemRequestForm = lazy(() => import('./pages/SchoolSystemRequestForm'));
const SchoolSystemRequestsView = lazy(() => import('./pages/SchoolSystemRequestsView'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard/index'));
const AdminDetails = lazy(() => import('./pages/AdminDetails'));
const AdminStats = lazy(() => import('./pages/AdminStats'));
const AdminExport = lazy(() => import('./pages/AdminExport'));

const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const AdminWhatsApp = lazy(() => import('./pages/AdminWhatsApp'));
const AdminTurmas = lazy(() => import('./pages/AdminTurmas'));
const AdminTurmaDetails = lazy(() => import('./pages/AdminTurmaDetails'));
const AdminAutoAllocation = lazy(() => import('./pages/AdminAutoAllocation'));
const AdminPlanAutoAllocation = lazy(() => import('./pages/AdminPlanAutoAllocation'));
const AdminBirthdays = lazy(() => import('./pages/AdminBirthdays'));
const AdminCarteirinhas = lazy(() => import('./pages/AdminCarteirinhas'));
const AdminTestes = lazy(() => import('./pages/AdminTestes'));
const AdminLinks = lazy(() => import('./pages/AdminLinks'));
const AdminFinanceiro = lazy(() => import('./pages/AdminFinanceiro'));
const AdminFinanceiroCobrancas = lazy(() => import('./pages/AdminFinanceiroCobrancas'));
const AdminRelatorioFinanceiro = lazy(() => import('./pages/AdminRelatorioFinanceiro'));
const AdminPaymentDetails = lazy(() => import('./pages/AdminPaymentDetails'));
const AdminPaymentProviderSettings = lazy(() => import('./pages/AdminPaymentProviderSettings'));
const AdminPatrocinadores = lazy(() => import('./pages/AdminPatrocinadores'));
const AdminMeuPlano = lazy(() => import('./pages/AdminMeuPlano'));
const AdminEscolaControle = lazy(() => import('./pages/AdminEscolaControle'));
const AdminDadosEscola = lazy(() => import('./pages/AdminDadosEscola'));
const AdminGastos = lazy(() => import('./pages/AdminGastos'));
const AdminNovoCadastro = lazy(() => import('./pages/AdminNovoCadastro'));
const AdminMigrateTurmas = lazy(() => import('./pages/AdminMigrateTurmas')); // Migration tool
const AdminAttendanceRecords = lazy(() => import('./pages/AdminAttendanceRecords'));
const ChamadaTurma = lazy(() => import('./pages/ChamadaTurma'));
const StudentContract = lazy(() => import('./pages/StudentContract'));
import { CustomDialogProvider } from './context/CustomDialogContext';
import MaintenanceGuard from './components/MaintenanceGuard';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { valorControle } from './shim/controle';
import NewVersionPrompt from './components/NewVersionPrompt';
import './App.css';

// Student Portal Imports
const StudentLogin = lazy(() => import('./pages/StudentLogin'));
const StudentLayout = lazy(() => import('./layouts/StudentLayout'));
const StudentHome = lazy(() => import('./pages/StudentHome'));
const StudentCarteirinha = lazy(() => import('./pages/StudentCarteirinha'));
const StudentPayments = lazy(() => import('./pages/StudentPayments'));
const StudentSettings = lazy(() => import('./pages/StudentSettings'));
const StudentWhatsApp = lazy(() => import('./pages/StudentWhatsApp'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const StudentAccess = lazy(() => import('./pages/StudentAccess'));
const StudentReservas = lazy(() => import('./pages/StudentReservas'));
const StudentWhatsPortaria = lazy(() => import('./pages/StudentWhatsPortaria'));
const StudentWhatsGrupo = lazy(() => import('./pages/StudentWhatsGrupo'));
const StudentEstatuto = lazy(() => import('./pages/StudentEstatuto'));
const StudentRegimento = lazy(() => import('./pages/StudentRegimento'));
const StudentRadio = lazy(() => import('./pages/StudentRadio'));
const StudentHorarios = lazy(() => import('./pages/StudentHorarios'));
const StudentFrequencia = lazy(() => import('./pages/StudentFrequencia'));
const StudentStore = lazy(() => import('./pages/StudentStore'));
const StudentAutorizacoes = lazy(() => import('./pages/StudentAutorizacoes'));
const MandatoryContractPage = lazy(() => import('./pages/MandatoryContractPage'));
const StudentContractView = lazy(() => import('./pages/StudentContractView'));

// Teacher Portal Imports
const TeacherLayout = lazy(() => import('./layouts/TeacherLayout'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const TeacherTurmaDetails = lazy(() => import('./pages/TeacherTurmaDetails'));
const TeacherStudentDetails = lazy(() => import('./pages/TeacherStudentDetails'));

const AdminTeachers = lazy(() => import('./pages/AdminTeachers')); // Import new component

import { LoadingProvider } from './components/LoadingService';

const AdminPlans = lazy(() => import('./pages/AdminPlans')); // Import new component
const AdminContractList = lazy(() => import('./pages/AdminContractList'));
const AdminContractTemplate = lazy(() => import('./pages/AdminContractTemplate'));
const AdminEmployees = lazy(() => import('./pages/AdminEmployees'));
const Portaria = lazy(() => import('./pages/Portaria'));
const AdminRentals = lazy(() => import('./pages/AdminRentals'));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const AdminSimuladorPage = lazy(() => import('./pages/AdminSimuladorPage'));
const AdminConvocacaoList = lazy(() => import('./pages/AdminConvocacaoList'));
const AdminConvocacaoDetails = lazy(() => import('./pages/AdminConvocacaoDetails'));
const AdminMidias = lazy(() => import('./pages/AdminMidias'));
const AdminDocumentos = lazy(() => import('./pages/AdminDocumentos'));
const AdminMensagens = lazy(() => import('./pages/AdminMensagens'));
const AdminMensagensCobrancas = lazy(() => import('./pages/AdminMensagens/AdminMensagensCobrancas'));
const AdminMensagensAutomacao = lazy(() => import('./pages/AdminMensagens/AdminMensagensAutomacao'));
const AdminMensagensFila = lazy(() => import('./pages/AdminMensagens/AdminMensagensFila'));
const AdminMensagensConfig = lazy(() => import('./pages/AdminMensagens/AdminMensagensConfig'));
const AdminMensagensHistorico = lazy(() => import('./pages/AdminMensagens/AdminMensagensHistorico'));
const AdminEvolutionMessages = lazy(() => import('./pages/AdminEvolutionMessages'));
const AdminStore = lazy(() => import('./pages/AdminStore'));

// Eventos (campeonatos, torneios e corridas)
const EventosLista = lazy(() => import('./pages/Eventos/EventosLista'));
const EventoPublico = lazy(() => import('./pages/Eventos/EventoPublico'));
const EventoEntrar = lazy(() => import('./pages/Eventos/EventoEntrar'));
const EventoInscrever = lazy(() => import('./pages/Eventos/EventoInscrever'));
const MinhaArea = lazy(() => import('./pages/Eventos/MinhaArea'));
const EquipePainel = lazy(() => import('./pages/Eventos/EquipePainel'));
const InscricaoPainel = lazy(() => import('./pages/Eventos/InscricaoPainel'));
const AdminEventos = lazy(() => import('./pages/AdminEventos'));
const AdminEventoForm = lazy(() => import('./pages/AdminEventos/AdminEventoForm'));
const AdminEventoDetalhe = lazy(() => import('./pages/AdminEventos/AdminEventoDetalhe'));
const AdminSumulaDigital = lazy(() => import('./pages/AdminEventos/AdminSumulaDigital'));

function App() {
  return (
    <CustomDialogProvider>
      <LoadingProvider>
        <BrowserRouter>
          {!valorControle('ocultar_instalar_app') && <PWAInstallPrompt />}
          <NewVersionPrompt />
          <Suspense fallback={<div className="rota-carregando" role="status" aria-label="Carregando"><i /></div>}>
          <Routes>
            <Route path="/" element={<PublicForm />} />
            <Route path="/solicitar-sistema-escola" element={<SchoolSystemRequestForm />} />
            <Route path="/solicitacoes-sistema-escola" element={<SchoolSystemRequestsView />} />
            <Route path="/chamada/:modalidadeId/:turmaId" element={<ChamadaTurma />} />
            <Route path="/chamada-v2/:id" element={<ChamadaTurma />} />

            {/* Eventos — páginas públicas e área do responsável */}
            <Route path="/eventos" element={<EventosLista />} />
            <Route path="/eventos/entrar" element={<EventoEntrar />} />
            <Route path="/eventos/minha-area" element={<MinhaArea />} />
            <Route path="/eventos/minha-area/equipe/:id" element={<EquipePainel />} />
            <Route path="/eventos/minha-area/inscricao/:id" element={<InscricaoPainel />} />
            <Route path="/eventos/:id" element={<EventoPublico />} />
            <Route path="/eventos/:id/inscrever" element={<EventoInscrever />} />

            {/* Student Routes */}
            {/* Student Routes */}
            <Route path="/aluno/login" element={<StudentLogin />} />
            <Route path="/aluno/contrato-obrigatorio/:registrationId?/:studentIndex?" element={<MandatoryContractPage />} />
            <Route path="/aluno/contrato/:id/:studentIndex" element={<StudentContractView />} />
            <Route path="/aluno" element={<StudentLayout />}>
              <Route path="dashboard" element={<StudentHome />} />
              <Route path="carteirinha" element={<StudentCarteirinha />} />
              <Route path="financeiro" element={<StudentPayments />} />
              <Route path="configuracoes" element={<StudentSettings />} />
              <Route path="perfil" element={<StudentProfile />} />
              <Route path="whatsapp" element={<StudentWhatsApp />} />
              <Route path="acessos" element={<StudentAccess />} />
              <Route path="reservas" element={<StudentReservas />} />
              <Route path="whats-portaria" element={<StudentWhatsPortaria />} />
              <Route path="whats-grupo" element={<StudentWhatsGrupo />} />
              <Route path="estatuto" element={<StudentEstatuto />} />
              <Route path="regimento" element={<StudentRegimento />} />
              <Route path="radio" element={<StudentRadio />} />
              <Route path="horarios" element={<StudentHorarios />} />
              <Route path="frequencia" element={<StudentFrequencia />} />
              <Route path="loja" element={<StudentStore />} />
              <Route path="autorizacoes" element={<StudentAutorizacoes />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Teacher Routes */}
            <Route path="/professor" element={<MaintenanceGuard><TeacherLayout /></MaintenanceGuard>}>
              <Route path="turmas" element={<TeacherDashboard />} />
              <Route path="turmas/:id" element={<TeacherTurmaDetails />} />
              <Route path="aluno/:id/:studentIndex" element={<TeacherStudentDetails />} />
              <Route path="reservas" element={<StudentReservas />} />
              <Route path="jogos/convocacao" element={<AdminConvocacaoList />} />
              <Route path="jogos/convocacao/:id" element={<AdminConvocacaoDetails />} />
              <Route index element={<Navigate to="turmas" replace />} />
            </Route>

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="cadastros/novo" element={<AdminNovoCadastro />} />
              <Route path="cadastros/pendentes" element={<AdminDashboard filterStatus="pendente" />} />
              <Route path="cadastros/desativados" element={<AdminDashboard filterStatus="desativados" />} />
              <Route path="stats" element={<AdminStats />} />
              <Route path="relatorios" element={<AdminReportsPage />} />
              <Route path="simulador" element={<AdminSimuladorPage />} />
              <Route path="export" element={<AdminExport />} />
              <Route path="financeiro" element={<AdminFinanceiro />} />
              <Route path="financeiro/gastos" element={<AdminGastos />} />
              <Route path="financeiro/cobrancas" element={<AdminFinanceiroCobrancas />} />
              <Route path="financeiro/relatorio" element={<AdminRelatorioFinanceiro />} />
              <Route path="financeiro/bancos" element={<AdminPaymentProviderSettings />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="plans/auto-allocation" element={<AdminPlanAutoAllocation />} />
              <Route path="professores" element={<AdminTeachers />} />
              <Route path="portaria" element={<Portaria />} /> {/* New route */}
              <Route path="alugueis" element={<AdminRentals />} />
              <Route path="payment-test" element={<AdminPaymentProviderSettings />} />

              <Route path="meu-plano" element={<AdminMeuPlano />} />
              <Route path="patrocinadores" element={<AdminPatrocinadores />} />
              <Route path="escola-controle" element={<AdminEscolaControle />} />
              <Route path="dados-escola" element={<AdminDadosEscola />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="whatsapp" element={<AdminWhatsApp />} />
              <Route path="details/:id" element={<AdminDetails />} />
              <Route path="turmas" element={<AdminTurmas />} />
              <Route path="turmas/chamadas" element={<AdminAttendanceRecords />} />
              <Route path="turmas/migration" element={<AdminMigrateTurmas />} />
              <Route path="turmas/auto-allocation" element={<AdminAutoAllocation />} />
              <Route path="turmas/:id" element={<AdminTurmaDetails />} />
              <Route path="carteirinhas" element={<AdminCarteirinhas />} />
              <Route path="aniversariantes" element={<AdminBirthdays />} />
              <Route path="links" element={<AdminLinks />} />
              <Route path="testes" element={<AdminTestes />} />
              <Route path="funcionarios" element={<AdminEmployees />} />
              <Route path="contratos" element={<AdminContractList />} />
              <Route path="contratos/modelo" element={<AdminContractTemplate />} />
              <Route path="contract/:id/:studentIndex?" element={<StudentContract />} />
              <Route path="jogos/convocacao" element={<AdminConvocacaoList />} />
              <Route path="midias" element={<AdminMidias />} />
              <Route path="documentos" element={<AdminDocumentos />} />
              <Route path="store" element={<AdminStore />} />
              <Route path="jogos/convocacao/:id" element={<AdminConvocacaoDetails />} />
              <Route path="eventos" element={<AdminEventos />} />
              <Route path="eventos/novo" element={<AdminEventoForm />} />
              <Route path="eventos/jogo/:id/sumula" element={<AdminSumulaDigital />} />
              <Route path="eventos/:id" element={<AdminEventoDetalhe />} />
              <Route path="eventos/:id/editar" element={<AdminEventoForm />} />
              <Route path="mensagens" element={<AdminMensagens />} />
              <Route path="mensagens/cobrancas" element={<AdminMensagensCobrancas />} />
              <Route path="mensagens/fila" element={<AdminMensagensFila />} />
              <Route path="mensagens/historico" element={<AdminMensagensHistorico />} />
              <Route path="mensagens/automacao" element={<AdminMensagensAutomacao />} />
              <Route path="mensagens/configuracoes" element={<AdminMensagensConfig />} />
              <Route path="mensagens-evolution" element={<AdminEvolutionMessages />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route path="/admin/financeiro/fatura/:id" element={<AdminPaymentDetails />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </LoadingProvider>
    </CustomDialogProvider >
  );
}

export default App;
