import 'package:flutter/material.dart';

void main() => runApp(const EloApp());

class C {
  static const bg=Color(0xFF101319), panel=Color(0xFF1B202A),
    tile=Color(0xFF262C37), line=Color(0xFF424956),
    blue=Color(0xFF84CFFF), pink=Color(0xFFF6A1CD),
    action=Color(0xFFFF84BE), muted=Color(0xFFC7D0DA);
}
class EloApp extends StatelessWidget {
  const EloApp({super.key, this.initialPage = 0});
  final int initialPage;
  @override Widget build(BuildContext context)=>MaterialApp(
    title:'App Elo',debugShowCheckedModeBanner:false,
    theme:ThemeData(
      useMaterial3:true,brightness:Brightness.dark,
      scaffoldBackgroundColor:C.bg,
      colorScheme:const ColorScheme.dark(primary:C.blue,secondary:C.action,surface:C.panel),
      inputDecorationTheme:InputDecorationTheme(
        filled:true,fillColor:C.panel,
        border:OutlineInputBorder(borderRadius:BorderRadius.circular(16)),
        enabledBorder:OutlineInputBorder(borderRadius:BorderRadius.circular(16),borderSide:const BorderSide(color:C.line)),
        focusedBorder:OutlineInputBorder(borderRadius:BorderRadius.circular(16),borderSide:const BorderSide(color:C.action)),
      ),
    ),
    home:EloFlow(initialPage:initialPage),
  );
}
class EloFlow extends StatefulWidget {
  const EloFlow({super.key, this.initialPage = 0});
  final int initialPage;
  @override State<EloFlow> createState()=>_EloFlowState();
}
class _EloFlowState extends State<EloFlow> {
  late int page;
  @override void initState(){super.initState();page=widget.initialPage;}
  final List<int> nav=[];
  final name=TextEditingController(),email=TextEditingController(),
    pass=TextEditingController(),chat=TextEditingController(),bio=TextEditingController(text:'Arte, cafés, boa música e conexões reais.');
  DateTime? birth;
  bool accepted=false, login=false, blocked=false, visible=true, distanceVisible=true;
  String identity='Mulher trans', pronouns='ela/dela';
  final Set<String> seeking={'Homens cis','Homens trans','Mulheres trans'};
  final List<String> sent=[];
  double distance=50;
  RangeValues age=const RangeValues(18,40);

  @override void dispose(){name.dispose();email.dispose();pass.dispose();chat.dispose();bio.dispose();super.dispose();}
  void go(int p){FocusManager.instance.primaryFocus?.unfocus();setState((){nav.add(page);page=p;});}
  void back(){setState((){page=nav.isEmpty?5:nav.removeLast();});}
  void notice(String s){ScaffoldMessenger.of(context).hideCurrentSnackBar();ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(s),behavior:SnackBarBehavior.floating,backgroundColor:C.tile));}

  Widget brand([double size=72])=>SizedBox(width:size,height:size*.8,child:Stack(children:[
    Positioned(left:0,child:Icon(Icons.favorite_border,color:C.pink,size:size*.78)),
    Positioned(right:0,child:Icon(Icons.favorite_border,color:C.blue,size:size*.78)),
  ]));

  Widget heading(String s,[String? desc])=>Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
    Text(s,style:const TextStyle(fontSize:27,fontWeight:FontWeight.w800)),
    if(desc!=null)...[const SizedBox(height:7),Text(desc,style:const TextStyle(color:C.muted,height:1.45))],
  ]);
  Widget button(String text,VoidCallback act,{bool alt=false,IconData? icon})=>SizedBox(width:double.infinity,height:52,child:FilledButton(
    onPressed:act,style:FilledButton.styleFrom(backgroundColor:alt?C.tile:C.action,foregroundColor:alt?Colors.white:C.bg,
      shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(28))),
    child:Row(mainAxisAlignment:MainAxisAlignment.center,children:[
      if(icon!=null)...[Icon(icon,size:19),const SizedBox(width:8)],
      Flexible(child:Text(text,softWrap:true,textAlign:TextAlign.center,maxLines:2,overflow:TextOverflow.ellipsis,style:const TextStyle(fontWeight:FontWeight.bold,fontSize:14))),
    ]),
  ));
  Widget tag(String text,{bool selected=false,VoidCallback? onTap})=>InkWell(
    onTap:onTap,borderRadius:BorderRadius.circular(24),
    child:Container(padding:const EdgeInsets.symmetric(horizontal:14,vertical:9),decoration:BoxDecoration(
      color:selected?C.action:C.tile,borderRadius:BorderRadius.circular(24),border:Border.all(color:selected?C.pink:C.line)),
      child:Text(text,style:TextStyle(fontSize:13,fontWeight:FontWeight.w600,color:selected?C.bg:Colors.white)),
    ),
  );
  Widget card(Widget child)=>Container(width:double.infinity,padding:const EdgeInsets.all(16),decoration:BoxDecoration(
    color:C.panel,borderRadius:BorderRadius.circular(20),border:Border.all(color:C.line.withValues(alpha:.6))),child:child);

  Widget portrait(String initial,{double height=220,bool blue=false})=>Container(
    width:double.infinity,height:height,alignment:Alignment.center,
    decoration:BoxDecoration(borderRadius:BorderRadius.circular(20),
      gradient:LinearGradient(begin:Alignment.topLeft,end:Alignment.bottomRight,
        colors:blue?[const Color(0xFF3D7DA5),C.bg,const Color(0xFF3A3D62)]
                   :[const Color(0xFFB36597),C.bg,const Color(0xFF55456D)])),
    child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[
      CircleAvatar(radius:48,backgroundColor:blue?C.blue:C.pink,
        child:Text(initial,style:const TextStyle(color:C.bg,fontSize:42,fontWeight:FontWeight.w900))),
      const SizedBox(height:14),
      const Text('PERFIL FICTÍCIO',style:TextStyle(letterSpacing:1.5,fontSize:10,color:C.muted)),
    ]),
  );

  Widget tabs()=>NavigationBar(
    backgroundColor:C.panel,indicatorColor:C.tile,
    selectedIndex:page==5?0:page==6?1:page==7?2:3,
    onDestinationSelected:(i)=>go([5,6,7,8][i]),
    destinations:const [
      NavigationDestination(icon:Icon(Icons.explore_outlined),label:'Descobrir'),
      NavigationDestination(icon:Icon(Icons.favorite_border),label:'Matches'),
      NavigationDestination(icon:Icon(Icons.chat_bubble_outline),label:'Chat'),
      NavigationDestination(icon:Icon(Icons.person_outline),label:'Perfil')
    ],
  );
  Widget screen(String title,Widget contents,{bool showBack=true,bool bottom=false})=>Scaffold(
    appBar:AppBar(backgroundColor:C.bg,leading:showBack?IconButton(onPressed:back,icon:const Icon(Icons.arrow_back_ios_new)):null,
      title:Text(title,style:const TextStyle(fontWeight:FontWeight.w800)),
      actions:[if(title!='Elo')Padding(padding:const EdgeInsets.only(right:15),child:brand(35))]),
    body:SafeArea(child:SingleChildScrollView(padding:const EdgeInsets.fromLTRB(20,12,20,32),child:contents)),
    bottomNavigationBar:bottom?tabs():null,
  );

  Widget opening()=>Scaffold(body:SafeArea(child:Container(
    width:double.infinity,padding:const EdgeInsets.all(28),
    decoration:const BoxDecoration(gradient:LinearGradient(begin:Alignment.topLeft,end:Alignment.bottomRight,
      colors:[Color(0xFF22465D),C.bg,Color(0xFF4A2542)])),
    child:Column(mainAxisAlignment:MainAxisAlignment.spaceEvenly,children:[
      Column(children:[
        brand(126),const SizedBox(height:14),
        const Text('Elo',style:TextStyle(fontSize:68,fontWeight:FontWeight.w900)),
        const SizedBox(height:15),
        const Text('Conexões reais, com respeito,\nidentidade e liberdade.',
          textAlign:TextAlign.center,style:TextStyle(fontSize:18,height:1.5)),
      ]),
      Column(children:[
        button('Começar',()=>go(1),icon:Icons.arrow_forward_rounded),
        const SizedBox(height:16),
        const Text('💙  🤍  💗',style:TextStyle(fontSize:22)),
      ]),
    ]),
  )));

  Widget welcome()=>screen('Boas-vindas',Column(children:[
    const SizedBox(height:15),portrait('❤',height:300),
    const SizedBox(height:26),
    heading('Bem-vinde ao Elo 💙💗🤍','Um espaço de encontros para pessoas trans, com respeito, segurança e diversidade.'),
    const SizedBox(height:34),
    button('Começar',(){login=false;go(2);},icon:Icons.arrow_forward),
    const SizedBox(height:12),
    button('Já tenho uma conta',(){login=true;go(2);},alt:true),
  ]));

  Future<void> pickBirth() async{
    final now=DateTime.now();
    final result=await showDatePicker(context:context,
      initialDate:DateTime(1998),firstDate:DateTime(1920),
      lastDate:DateTime(now.year-18,now.month,now.day));
    if(result!=null)setState(()=>birth=result);
  }

  Widget auth()=>screen(login?'Entrar':'Criar conta',Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
      Center(child:brand(76)),const SizedBox(height:20),
      heading(login?'Bem-vinde de volta!':'Criar conta','É rápido e simples. Vamos lá? 💙💗🤍'),
      const SizedBox(height:18),
      if(!login)...[
        const Text('Nome ou apelido'),const SizedBox(height:8),
        TextField(controller:name,decoration:const InputDecoration(prefixIcon:Icon(Icons.person_outline),hintText:'Seu nome')),
        const SizedBox(height:12),
      ],
      const Text('E-mail'),const SizedBox(height:8),
      TextField(controller:email,keyboardType:TextInputType.emailAddress,
        decoration:const InputDecoration(prefixIcon:Icon(Icons.email_outlined),hintText:'Seu e-mail')),
      const SizedBox(height:12),const Text('Senha'),const SizedBox(height:8),
      TextField(controller:pass,obscureText:true,
        decoration:const InputDecoration(prefixIcon:Icon(Icons.lock_outline),hintText:'Sua senha')),
      if(!login)...[
        const SizedBox(height:12),
        OutlinedButton.icon(onPressed:pickBirth,icon:const Icon(Icons.calendar_month),
          label:Text(birth==null?'Data de nascimento (+18)':
            '${birth!.day}/${birth!.month}/${birth!.year}')),
        CheckboxListTile(contentPadding:EdgeInsets.zero,value:accepted,activeColor:C.action,
          onChanged:(v)=>setState(()=>accepted=v??false),
          title:const Text('Tenho 18 anos ou mais e aceito os termos e a política de privacidade.',
            style:TextStyle(fontSize:12))),
      ],
      const SizedBox(height:18),
      button(login?'Entrar (demonstração)':'Continuar (demonstração)',(){
        if(!email.text.contains('@')||pass.text.length<6){notice('Insira e-mail válido e senha com 6 ou mais caracteres.');return;}
        if(!login&&(name.text.trim().isEmpty||birth==null||!accepted)){notice('Preencha nome, nascimento e aceite os termos.');return;}
        notice('Demonstração local. Cadastro real aguarda integração do backend.');
        go(3);
      }),
      const SizedBox(height:12),
      Center(child:TextButton(onPressed:()=>setState(()=>login=!login),
        child:Text(login?'Criar nova conta':'Já tenho uma conta',style:const TextStyle(color:C.blue)))),
      if(login)Center(child:TextButton(onPressed:()=>notice('Recuperação de senha ainda não integrada ao servidor.'),
        child:const Text('Recuperar senha',style:TextStyle(color:C.pink)))),
      const SizedBox(height:12),
      const Center(child:Text('Ambiente de demonstração. Não use dados pessoais reais.',
        style:TextStyle(fontSize:11,color:C.muted),textAlign:TextAlign.center)),
    ],
  ));

  Widget identityPage()=>screen('Identidade e pronomes',Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
      heading('Sua identidade','Como você se identifica?'),
      const SizedBox(height:18),
      for(final option in ['Homem trans','Mulher trans','Homem cis','Mulher cis'])
        Padding(padding:const EdgeInsets.only(bottom:8),
          child:ListTile(title:Text(option),tileColor:C.panel,
            trailing:Icon(identity==option?Icons.radio_button_checked:Icons.radio_button_unchecked,
                color:identity==option?C.action:C.muted),
            onTap:()=>setState(()=>identity=option),
            shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(13)))),
      const SizedBox(height:20),
      heading('Seus pronomes','Opcional. Não define suas preferências de encontro.'),
      const SizedBox(height:14),
      Wrap(spacing:8,runSpacing:8,children:[
        for(final p in ['ele/dele','ela/dela','elu/delu','Não informar'])
          tag(p,selected:pronouns==p,onTap:()=>setState(()=>pronouns=p)),
      ]),
      const SizedBox(height:36),
      button('Continuar',()=>go(4),icon:Icons.arrow_forward),
    ],
  ));

  Widget filters()=>screen('Filtros e preferências',Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
      heading('Quem você quer conhecer?','Selecione livremente uma ou mais opções.'),
      const SizedBox(height:16),
      for(final option in ['Homens cis','Homens trans','Mulheres cis','Mulheres trans'])
        Padding(padding:const EdgeInsets.only(bottom:7),
          child:CheckboxListTile(value:seeking.contains(option),title:Text(option),tileColor:C.panel,
            activeColor:C.action,
            shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(14)),
            onChanged:(v)=>setState((){if(v==true){seeking.add(option);}else{seeking.remove(option);}}))),
      const SizedBox(height:20),
      heading('Localização','Até ${distance.round()} km'),
      Slider(value:distance,min:1,max:100,onChanged:(v)=>setState(()=>distance=v)),
      const SizedBox(height:10),
      heading('Idade','${age.start.round()} a ${age.end.round()} anos'),
      RangeSlider(values:age,min:18,max:80,onChanged:(v)=>setState(()=>age=v)),
      const SizedBox(height:20),
      button('Aplicar filtros',(){
        if(seeking.isEmpty){notice('Selecione ao menos uma opção.');return;}
        go(5);
      }),
    ],
  ));

  Widget discover()=>screen('Elo',Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
      heading('Descobrir','Conheça novas pessoas com respeito e liberdade.'),
      const SizedBox(height:16),portrait('L',height:290,blue:true),
      const SizedBox(height:14),
      const Text('Leo, 27',style:TextStyle(fontSize:29,fontWeight:FontWeight.w800)),
      const SizedBox(height:6),
      const Text('Homem trans • 12 km (simulado)',style:TextStyle(color:C.muted)),
      const SizedBox(height:14),
      Wrap(spacing:8,runSpacing:8,children:[tag('🎵 Música'),tag('☕ Café'),tag('🥾 Trilhas')]),
      const SizedBox(height:24),
      Row(children:[
        Expanded(child:IconButton.filledTonal(onPressed:()=>notice('Perfil ignorado em modo demonstração.'),
          icon:const Icon(Icons.close,size:27),tooltip:'Passar')),
        const SizedBox(width:10),
        Expanded(child:IconButton.filled(
          style:IconButton.styleFrom(backgroundColor:C.action,foregroundColor:C.bg),
          onPressed:()=>go(6),icon:const Icon(Icons.favorite,size:27),tooltip:'Curtir')),
        const SizedBox(width:10),
        Expanded(child:IconButton.filledTonal(onPressed:()=>go(8),
          icon:const Icon(Icons.person_outline,size:27),tooltip:'Abrir perfil')),
      ]),
    ],
  ),showBack:false,bottom:true);

  Widget matchPage()=>screen('Match',Column(children:[
    const SizedBox(height:18),
    Row(children:[
      Expanded(child:portrait('L',height:220,blue:true)),
      const SizedBox(width:10),
      Expanded(child:portrait('B',height:220)),
    ]),
    const SizedBox(height:27),
    const Icon(Icons.favorite,color:C.action,size:68),
    const Text('Deu match! 💗',style:TextStyle(fontSize:34,fontWeight:FontWeight.w900)),
    const SizedBox(height:10),
    const Text('Vocês se curtiram mutuamente!',textAlign:TextAlign.center),
    const SizedBox(height:30),
    button('Enviar mensagem',()=>go(7),icon:Icons.chat_bubble_outline),
    const SizedBox(height:12),
    button('Continuar descobrindo',()=>go(5),alt:true),
    const SizedBox(height:20),
    const Text('Match fictício da demonstração local.',
      style:TextStyle(fontSize:11,color:C.muted)),
  ]),bottom:true);

  Widget bubble(String text,{bool own=false})=>Align(
    alignment:own?Alignment.centerRight:Alignment.centerLeft,
    child:Container(constraints:const BoxConstraints(maxWidth:275),
      margin:const EdgeInsets.symmetric(vertical:5),
      padding:const EdgeInsets.all(13),
      decoration:BoxDecoration(color:own?C.action:C.tile,borderRadius:BorderRadius.circular(17)),
      child:Text(text,style:TextStyle(color:own?C.bg:Colors.white))),
  );
  Widget chatPage()=>Scaffold(
    appBar:AppBar(backgroundColor:C.bg,
      leading:IconButton(icon:const Icon(Icons.arrow_back_ios_new),onPressed:back),
      title:const ListTile(contentPadding:EdgeInsets.zero,leading:CircleAvatar(
        backgroundColor:C.pink,child:Text('B',style:TextStyle(color:C.bg))),
        title:Text('Bia'),subtitle:Text('Chat demonstrativo',style:TextStyle(color:C.muted,fontSize:11))),
      actions:[IconButton(onPressed:()=>go(9),icon:const Icon(Icons.shield_outlined),tooltip:'Segurança')]),
    body:SafeArea(child:Column(children:[
      Expanded(child:ListView(padding:const EdgeInsets.all(20),children:[
        const Center(child:Text('Mensagens locais, sem servidor',
          style:TextStyle(color:C.muted,fontSize:11))),
        const SizedBox(height:15),
        bubble('Oi! Que bom que deu match! 💗'),
        bubble('Também fiquei feliz! 😊',own:true),
        bubble('Topa trocar uma ideia?'),
        for(final text in sent)bubble(text,own:true),
      ])),
      Container(color:C.panel,padding:const EdgeInsets.fromLTRB(12,7,12,12),child:Row(children:[
        Expanded(child:TextField(controller:chat,maxLines:3,minLines:1,
          decoration:const InputDecoration(hintText:'Digite uma mensagem...'))),
        const SizedBox(width:9),
        IconButton.filled(style:IconButton.styleFrom(backgroundColor:C.action,foregroundColor:C.bg),
          onPressed:(){final msg=chat.text.trim();if(msg.isNotEmpty)setState((){sent.add(msg);chat.clear();});},
          icon:const Icon(Icons.send)),
      ])),
    ])),
  );
  Widget profile()=>screen('Perfil completo',Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
      portrait('B',height:255),
      const SizedBox(height:16),
      heading('Bia, 26','Mulher trans • perfil fictício de demonstração'),
      const SizedBox(height:22),heading('Sobre mim'),
      const SizedBox(height:9),Text(bio.text,style:const TextStyle(color:C.muted,height:1.5)),
      const SizedBox(height:22),heading('Interesses'),
      const SizedBox(height:12),
      Wrap(spacing:8,runSpacing:8,children:[tag('🎨 Arte'),tag('🎬 Filmes'),tag('📚 Livros'),tag('☕ Café'),tag('🎵 Música')]),
      const SizedBox(height:27),
      button('Editar bio de demonstração',()async{
        await showDialog<void>(context:context,builder:(ctx)=>AlertDialog(
          title:const Text('Editar bio'),
          content:TextField(controller:bio,maxLines:4),
          actions:[TextButton(onPressed:()=>Navigator.pop(ctx),child:const Text('Salvar'))],
        ));
        if(mounted)setState((){});
      },alt:true),
      const SizedBox(height:12),
      button('Segurança e privacidade',()=>go(9),icon:Icons.shield_outlined),
    ],
  ),bottom:true);
  Widget settingsRow(IconData icon,String label,String sub,VoidCallback tap)=>Padding(
    padding:const EdgeInsets.only(bottom:9),
    child:card(Material(color:Colors.transparent,child:ListTile(contentPadding:EdgeInsets.zero,
      leading:Icon(icon,color:C.action),title:Text(label,style:const TextStyle(fontWeight:FontWeight.w700)),
      subtitle:Text(sub,style:const TextStyle(color:C.muted,fontSize:12)),
      trailing:const Icon(Icons.chevron_right),onTap:tap))),
  );

  Widget privacy()=>screen('Segurança e privacidade',Column(children:[
    brand(82),const SizedBox(height:15),
    heading('Seu espaço, suas regras','Privacidade, segurança e respeito sempre.'),
    const SizedBox(height:23),
    settingsRow(Icons.verified_user_outlined,'Verificação de perfil','Pendente de integração real.',
      ()=>notice('Verificação real ainda não implementada.')),
    settingsRow(Icons.block,'Bloquear usuário',blocked?'Bloqueado apenas nesta demonstração':'Simulação local, não bloqueia contas reais.',
      ()=>setState(()=>blocked=!blocked)),
    settingsRow(Icons.flag_outlined,'Denunciar','Denúncia real aguarda backend.',
      ()=>notice('Envio de denúncias ainda não implementado.')),
    settingsRow(Icons.lightbulb_outline,'Dicas de segurança','Proteja seus dados e marque encontros em locais públicos.',
      ()=>showDialog<void>(context:context,builder:(ctx)=>AlertDialog(
        title:const Text('Dicas de segurança'),
        content:const Text('Evite compartilhar endereço, documentos e informações financeiras. Combine encontros em locais públicos.'),
        actions:[TextButton(onPressed:()=>Navigator.pop(ctx),child:const Text('Entendi'))]))),
    SwitchListTile(value:visible,title:const Text('Exibir meu perfil'),
      subtitle:const Text('Apenas estado local de demonstração'),
      onChanged:(v)=>setState(()=>visible=v)),
    SwitchListTile(value:distanceVisible,title:const Text('Exibir distância aproximada'),
      subtitle:const Text('Nunca mostrar GPS exato'),
      onChanged:(v)=>setState(()=>distanceVisible=v)),
    const SizedBox(height:18),
    const Text('Protótipo funcional local. Backend, autenticação, bloqueios reais, denúncias e LGPD operacional ainda pendentes.',
      textAlign:TextAlign.center,style:TextStyle(color:C.muted,fontSize:11)),
  ]));

  @override Widget build(BuildContext context)=>switch(page){
    0=>opening(),1=>welcome(),2=>auth(),3=>identityPage(),4=>filters(),
    5=>discover(),6=>matchPage(),7=>chatPage(),8=>profile(),9=>privacy(),
    _=>opening(),
  };
}
